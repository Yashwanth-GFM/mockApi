import express from "express";
import fs from "fs";
import path from "path";
// import listings from "../data/listings.json" assert { type: "json" };

const listings = JSON.parse(
  fs.readFileSync(new URL("../data/mock_listings_us1.json", import.meta.url)),
);

const POLYGON_FILE = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../data/polygon.json",
);
const savePolygonToFile = (id, polygon) => {
  let data = {};

  try {
    if (fs.existsSync(POLYGON_FILE)) {
      const fileContent = fs.readFileSync(POLYGON_FILE, "utf-8").trim();

      if (fileContent) {
        data = JSON.parse(fileContent);
      }
    }
  } catch (err) {
    console.error("⚠️ Polygon JSON corrupted. Resetting file.", err);
    data = {};
  }

  data[id] = polygon;

  fs.writeFileSync(POLYGON_FILE, JSON.stringify(data, null, 2));
};

const getPolygonFromFile = (id) => {
  try {
    if (!fs.existsSync(POLYGON_FILE)) return null;

    const fileContent = fs.readFileSync(POLYGON_FILE, "utf-8").trim();
    if (!fileContent) return null;

    const data = JSON.parse(fileContent);
    return data[id] || null;
  } catch (err) {
    console.error("⚠️ Failed to read polygon file", err);
    return null;
  }
};

const router = express.Router();
// Convert polygon string to array of points
function parseWKTPolygon(wkt) {
  const coords = wkt.replace("POLYGON ((", "").replace("))", "").split(",");

  return coords.map((c) => {
    const [lng, lat] = c.trim().split(" ").map(Number);
    return { lat, lng };
  });
}

// Ray Casting Algorithm
const isPointInsidePolygon = (point, polygon) => {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
};
function toWKT(polygonString) {
  const polygons = polygonString.split(":");

  const wktPolygons = polygons.map((poly) => {
    const points = poly.split("|");

    const coords = points.map((point) => {
      const [lat, lng] = point.split(",").map(Number);
      return `${lng} ${lat}`; // WKT = lng lat
    });

    return `((${coords.join(", ")}))`;
  });

  if (wktPolygons.length === 1) {
    return `POLYGON ${wktPolygons[0]}`;
  }

  return `MULTIPOLYGON (${wktPolygons.join(", ")})`;
}

router.post("/v1/draw-polygon", (req, res) => {
  const { polygon } = req.body;

  if (!polygon || typeof polygon !== "string") {
    return res.status(400).json({ error: "polygon must be a string" });
  }

  const polygons = polygon.split(":");

  const isValid = polygons.every((poly) => {
    if (!poly.trim()) return false;

    const points = poly.split("|");
    if (points.length < 4) return false;
    if (points[0] !== points[points.length - 1]) return false;

    return points.every((point) => {
      const [lat, lng] = point.split(",");
      const latNum = Number(lat);
      const lngNum = Number(lng);

      return (
        Number.isFinite(latNum) &&
        Number.isFinite(lngNum) &&
        latNum >= -90 &&
        latNum <= 90 &&
        lngNum >= -180 &&
        lngNum <= 180
      );
    });
  });

  if (!isValid) {
    return res.status(400).json({ error: "Invalid polygon format" });
  }

  const drawPolygonId = Date.now().toString();
  const wkt = toWKT(polygons.join(":"));

  savePolygonToFile(drawPolygonId, wkt);

  res.json({
    drawPolygonId,
  });
});

router.post("/v1/listings", (req, res) => {
  const {
    mapBounds,
    mapZoom,
    listingType,
    propertyFilter,
    regionSelection,
    page = 1,
    size = 60,
  } = req.body;

  let polygonRegionId = regionSelection?.regionId;
  let filteredListings = listings;

  if (listingType) {
    filteredListings = filteredListings.filter(
      (listing) => listing.listingStatus === listingType,
    );
  }

  // 🧭 1. Filter by map bounds (lat/lng)
  if (mapBounds) {
    const { west, east, south, north } = mapBounds;
    const n = Math.max(Number(north), Number(south));
    const s = Math.min(Number(north), Number(south));
    const e = Math.max(Number(east), Number(west));
    const w = Math.min(Number(east), Number(west));

    filteredListings = filteredListings.filter((listing) => {
      return (
        listing.location.lat >= s &&
        listing.location.lat <= n &&
        listing.location.lng >= w &&
        listing.location.lng <= e
      );
    });
  }

  if (polygonRegionId) {
    const polygonStr = getPolygonFromFile(polygonRegionId);

    if (!polygonStr) {
      return res.status(400).json({
        error: "Invalid polygonRegionId",
      });
    }

    const polygonPoints = parseWKTPolygon(polygonStr);

    filteredListings = filteredListings.filter((listing) =>
      isPointInsidePolygon(
        {
          lat: listing.location.lat,
          lng: listing.location.lng,
        },
        polygonPoints,
      ),
    );
  }

  // 🔍 Zoom-level logic
  // Adjust how many listings are returned based on zoom level
  if (mapZoom !== undefined) {
    if (mapZoom < 5) {
      // Very far zoomed out — return very few listings (e.g. 0%)
      const sampleSize = Math.ceil(filteredListings.length * 0);
      filteredListings = filteredListings.slice(0, sampleSize);
    } else if (mapZoom >= 5 && mapZoom < 10) {
      // Far zoomed out — return fewer listings (e.g. 5%)
      const sampleSize = Math.ceil(filteredListings.length * 0.1);
      filteredListings = filteredListings.slice(0, sampleSize);
    } else if (mapZoom >= 10 && mapZoom < 18) {
      // Medium zoom — 20%
      const sampleSize = Math.ceil(filteredListings.length * 0.2);
      filteredListings = filteredListings.slice(0, sampleSize);
    }
  }

  // 🧹 Helper to check for valid numeric values
  const isValidNumber = (value) =>
    value !== "" && value !== null && !isNaN(value);

  // 💰 2. Price Filter
  if (propertyFilter?.price) {
    const { min, max } = propertyFilter.price;
    if (isValidNumber(min)) {
      filteredListings = filteredListings.filter(
        (l) => l.salePrice >= Number(min),
      );
    }
    if (isValidNumber(max)) {
      filteredListings = filteredListings.filter(
        (l) => l.salePrice <= Number(max),
      );
    }
  }

  // 🛏️ 3. Beds Filter
  if (isValidNumber(propertyFilter?.beds?.min)) {
    filteredListings = filteredListings.filter(
      (l) => l.beds >= Number(propertyFilter.beds.min),
    );
  }

  // 🛁 4. Baths Filter
  if (isValidNumber(propertyFilter?.baths?.min)) {
    filteredListings = filteredListings.filter(
      (l) => l.baths >= Number(propertyFilter.baths.min),
    );
  }

  // 📄 6. Pagination
  const total = filteredListings.length;
  const start = (page - 1) * size;
  const end = start + size;
  // const paginatedListings = filteredListings.slice(start, end);

  // 📤 Response
  res.json({
    polygon: getPolygonFromFile(polygonRegionId) || null,
    content: filteredListings,
  });
});

router.get("/v1/listings", (req, res) => {
  const { listing_id } = req.query;

  try {
    // const listing = listings.find((l) => l.listingId === id);
    const listing = listings.find((l) => l.listingId === listing_id);
    res.json(listing);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
