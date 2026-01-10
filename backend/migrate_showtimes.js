// Migration script: Convert to hierarchical schema
// Film → Region → Cinema → Date → Showtimes

var count = 0;

// Process old format documents (with showtimes.<date> at top level)
db.showtimes.find({ showtimes: { $exists: true }, regions: { $exists: false } }).forEach(function (doc) {
    var filmId = doc.film_id;
    var provinceSlug = doc.province_slug || "napoli";

    // Build regions structure from showtimes
    var regions = {};
    regions[provinceSlug] = { cinemas: {} };

    // Get cinemas from each date in showtimes
    for (var dateStr in doc.showtimes) {
        var cinemasForDate = doc.showtimes[dateStr];
        if (Array.isArray(cinemasForDate)) {
            cinemasForDate.forEach(function (cinema) {
                var cinemaName = cinema.cinema_name || "Unknown";
                var cinemaKey = cinemaName.replace(/\./g, "_").replace(/\$/g, "_");

                if (!regions[provinceSlug].cinemas[cinemaKey]) {
                    regions[provinceSlug].cinemas[cinemaKey] = {
                        cinema_name: cinemaName,
                        cinema_url: cinema.cinema_url || "",
                        dates: {}
                    };
                }
                regions[provinceSlug].cinemas[cinemaKey].dates[dateStr] = cinema.shows || [];
            });
        }
    }

    // Update document
    db.showtimes.updateOne(
        { _id: doc._id },
        {
            $set: { regions: regions },
            $unset: { showtimes: "", province_slug: "", province: "" }
        }
    );
    count++;
});

print("Migrated " + count + " documents to hierarchical schema");

// Show sample of new format
var sample = db.showtimes.findOne({ regions: { $exists: true } });
if (sample) {
    print("Sample document:");
    printjson({
        film_id: sample.film_id,
        film_title: sample.film_title,
        regions_keys: Object.keys(sample.regions || {})
    });
}
