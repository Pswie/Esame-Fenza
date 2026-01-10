// Check new schema format
var doc = db.showtimes.findOne({});
if (doc && doc.regions && doc.regions.napoli && doc.regions.napoli.dates) {
    var dates = Object.keys(doc.regions.napoli.dates);
    print("Film: " + doc.film_title);
    print("Dates: " + dates.join(", "));
    if (dates.length > 0) {
        var dateData = doc.regions.napoli.dates[dates[0]];
        print("Date: " + dates[0]);
        var cinemas = Object.keys(dateData.cinemas || {});
        print("Cinemas: " + cinemas.length);
        if (cinemas.length > 0) {
            var cinema = dateData.cinemas[cinemas[0]];
            print("Cinema: " + cinema.cinema_name);
            print("Showtimes: " + JSON.stringify(cinema.showtimes));
        }
    }
} else {
    print("No data found with new schema");
    printjson(doc);
}
