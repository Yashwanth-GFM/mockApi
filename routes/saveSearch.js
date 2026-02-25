// import express from "express";

// const router = express.Router();

// router.post("/v1/saved-search", (req, res) => {
//   const arr = req.body;
//   const date = new Date();
//   arr.createdAt = date;

//   try {
//     res.status(200).json({ message: "Search saved successfully", data: arr });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// router.put("/v1/saved-search", (req, res) => {
//   const arr = req.body;
//   const index = data.findIndex(
//     (item) => item.savedSearchId === arr.savedSearchId,
//   );
//   if (index !== -1) {
//     data[index] = { ...data[index], ...arr };
//   }
//   try {
//     res.status(200).json({ message: "Search updated successfully", data: arr });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// router.get("/v1/saved-search", (req, res) => {
//   try {
//     res.status(200).json({ savedSearch: data });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// router.delete("/v1/saved-search", (req, res) => {
//   const { savedSearchId } = req.query;
//   const index = data.findIndex((item) => item.savedSearchId === savedSearchId);
//   if (index !== -1) {
//     data.splice(index, 1);
//   }
//   try {
//     res.status(200).json({ success: true });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// export default router;

import express from "express";
import { readSavedSearches, writeSavedSearches } from "../utils/fileStore.js";

const router = express.Router();

router.post("/v1/saved-search", (req, res) => {
  try {
    const savedSearches = readSavedSearches();

    const newSearch = {
      ...req.body,
      savedSearchId: String(savedSearches.length + 1),
      createdAt: new Date().toISOString(),
    };

    savedSearches.push(newSearch);
    writeSavedSearches(savedSearches);

    res.status(200).json(newSearch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/v1/saved-search", (req, res) => {
  try {
    const savedSearches = readSavedSearches();
    const { savedSearchId } = req.body;

    const index = savedSearches.findIndex(
      (item) => item.savedSearchId === savedSearchId,
    );

    if (index === -1) {
      return res.status(404).json({ error: "Search not found" });
    }

    savedSearches[index] = {
      ...savedSearches[index],
      ...req.body,
    };

    writeSavedSearches(savedSearches);

    res.status(200).json({
      savedSearch: savedSearches[index],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/v1/saved-search", (req, res) => {
  try {
    const savedSearches = readSavedSearches();

    res.status(200).json( savedSearches );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/v1/saved-search", (req, res) => {
  try {
    const { savedSearchId } = req.body;
    console.log(savedSearchId);
    
  
    const savedSearches = readSavedSearches();

    const filtered = savedSearches.filter(
      (item) => item.savedSearchId !== savedSearchId,
    );

    writeSavedSearches(filtered);

    res.status(200).json(true);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
