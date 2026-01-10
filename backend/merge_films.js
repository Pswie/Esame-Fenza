// Migration script: Merge documents with same film_id into one
// Consolidate all regions into a single document per film

print("=== Starting film merge migration ===");

// Get all unique film_ids
var filmIds = db.showtimes.distinct("film_id");
print("Found " + filmIds.length + " unique films");

var mergedCount = 0;
var deletedCount = 0;

filmIds.forEach(function (filmId) {
    // Find all documents for this film
    var docs = db.showtimes.find({ film_id: filmId }).toArray();

    if (docs.length > 1) {
        print("Merging " + docs.length + " documents for film: " + filmId);

        // Use first doc as base
        var baseDoc = docs[0];
        var mergedRegions = baseDoc.regions || {};

        // Merge regions from other docs
        for (var i = 1; i < docs.length; i++) {
            var otherDoc = docs[i];
            var otherRegions = otherDoc.regions || {};

            for (var regionSlug in otherRegions) {
                if (!mergedRegions[regionSlug]) {
                    // Add entire new region
                    mergedRegions[regionSlug] = otherRegions[regionSlug];
                } else {
                    // Merge cinemas within region
                    var otherCinemas = otherRegions[regionSlug].cinemas || {};
                    for (var cinemaKey in otherCinemas) {
                        if (!mergedRegions[regionSlug].cinemas[cinemaKey]) {
                            mergedRegions[regionSlug].cinemas[cinemaKey] = otherCinemas[cinemaKey];
                        } else {
                            // Merge dates
                            var otherDates = otherCinemas[cinemaKey].dates || {};
                            for (var dateStr in otherDates) {
                                mergedRegions[regionSlug].cinemas[cinemaKey].dates[dateStr] = otherDates[dateStr];
                            }
                        }
                    }
                }
            }

            // Delete merged document
            db.showtimes.deleteOne({ _id: otherDoc._id });
            deletedCount++;
        }

        // Update base doc with merged regions
        db.showtimes.updateOne(
            { _id: baseDoc._id },
            { $set: { regions: mergedRegions } }
        );
        mergedCount++;
    }
});

print("=== Migration complete ===");
print("Merged " + mergedCount + " films");
print("Deleted " + deletedCount + " duplicate documents");
print("Remaining documents: " + db.showtimes.countDocuments({}));

// Show sample
var sample = db.showtimes.findOne({});
if (sample) {
    print("Sample film: " + sample.film_title);
    print("Regions: " + Object.keys(sample.regions || {}).join(", "));
}
