const { bucket, admin } = require("../config/firebase");
const db = admin.firestore();

/**
 * GET /api/getmetadata
 * Query params:
 *  - pageSize (default 10)
 *  - pageToken (doc id of last item from previous page)
 *  - search      (prefix search on nameLower; store a lowercase field in docs)
 *  - skill       (expects "skills" to be an array -> array-contains)
 *  - location    (exact match)
 *  - sector      (exact match)
 *  - sortBy      ("recent" => order by uploadedAt desc; default asc)
 *
 * Notes:
 *  - If you don't have `nameLower` in your documents, replace orderBy("nameLower")
 *    with orderBy("name") BUT search will then be case-sensitive.
 *  - For search + recent ordering, we add a secondary orderBy on uploadedAt (needs composite index).
 */
exports.getAllMetadata = async (req, res) => {
  try {
    let { pageSize = 10, pageToken, search, skill, location, sector, sortBy } = req.query;

    const capitalizeFirstLetter = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    const toLowerCaseString = (str) => str.toLowerCase();

    if (location) location = toLowerCaseString(location);
    if (sector) sector = toLowerCaseString(sector);
    if (search) search = toLowerCaseString(search);
    if (skill) skill=toLowerCaseString(skill)
    pageSize = parseInt(pageSize, 10);

    let queryRef = db.collection("resumes");

    // 🔍 Filters
    if (skill) {
      queryRef = queryRef.where("skills", "array-contains", skill);
    }
    if (location) {
      queryRef = queryRef
        .where("location", ">=", location)
        .where("location", "<=", location + "\uf8ff");
    }
    if (sector) {
      queryRef = queryRef
        .where("sector", ">=", sector)
        .where("sector", "<=", sector + "\uf8ff");
    }

    // 📌 Sorting
    if (search) {
      queryRef = queryRef.orderBy("name").startAt(search).endAt(search + "\uf8ff");
    } else if (sortBy === "recent") {
      queryRef = queryRef.orderBy("uploadedAt", "desc");
    } else {
      // default A → Z
      queryRef = queryRef.orderBy("name", "asc");
    }

    // 📌 Pagination
    if (pageToken) {
      const lastDoc = await db.collection("resumes").doc(pageToken).get();
      if (lastDoc.exists) {
        queryRef = queryRef.startAfter(lastDoc);
      }
    }

    // 📌 Limit
    queryRef = queryRef.limit(pageSize);

    const snapshot = await queryRef.get();

    const metadata = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const nextPageToken =
      snapshot.size > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null;

    res.status(200).json({ metadata, nextPageToken });
  } catch (error) {
    console.error("Error fetching resumes:", error);
    res.status(500).json({ error: "Failed to fetch resumes." });
  }
};




exports.getCandidateCount = async (req, res) => {
  try {
    const snapshot = await db.collection("resumes").count().get(); // Firestore count aggregation
    res.json({ total: snapshot.data().count });
  } catch (error) {
    console.error("Error getting count:", error);
    res.status(500).json({ error: "Failed to get candidate count" });
  }
};

exports.getHiredCount = async (req, res) => {
  try {
    const snapshot = await db
      .collection("resumes")
      .where("hiringstatus", "in", ["hired", "Hired", "Hired "])
      .count()
      .get();

    res.json({ total: snapshot.data().count });
  } catch (error) {
    console.error("Error getting hired count:", error);
    res.status(500).json({ error: "Failed to get hired candidate count" });
  }
};
