var stremio = require("stremio-addons");
var _ = require("lodash");
var async = require("async");
var needle = require("needle");
var fs = require('fs');

var manifest = { 
    "name": "Popcorn",
    "description": "Watch from YTS and EZTV",
    //"icon": "URL to 256x256 monochrome png icon", "background": "URL to 1366x756 png background",
    "id": "org.jcb9090.popcorn",
    "version": "1.0.0",
    "types": ["movie", "series"],
    "filter": { "query.imdb_id": { "$exists": true }, "query.type": { "$in":["series","movie"] } }
};

/* SERVE DATA
 */
var map = { };
//var cacheMap = function() { }

var addon = new stremio.Server({
    "stream.find": function(args, callback, user) {
        if (! args.query) return callback();

        var hash = (args.query.hasOwnProperty('season') ? [args.query.imdb_id, args.query.season, args.query.episode] : [args.query.imdb_id]).join(" ");
        //console.log(hash)

        callback(null, _.map(map[hash] || [], function(infoHash, quality) { 
            return {
                infoHash: infoHash,
                tag: [quality].concat(quality == "1080p" ? ["hd"] : []),
                name: args.query.hasOwnProperty('season') ? "EZTV" : "YTS"
            }
        }));
    }
}, { secret: "8417fe936f0374fbd16a699668e8f3c4aa405d9f" }, manifest);

var server = require("http").createServer(function (req, res) {
    addon.middleware(req, res, function() { res.end() }); // wire the middleware - also compatible with connect / express
}).on("listening", function()
{
    console.log("Popcorn Addon listening on "+server.address().port);
}).listen(process.env.PORT || 7000);

/* COLLECT DATA
 */
var httpOpts = { 
    headers: { user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/28.0.1500.52 Chrome/28.0.1500.52 Safari/537.36" },
    json: true
};
var queue = async.queue(function(url, next) {
    console.log("-> collecting from "+url);
    needle.get(url, httpOpts, function(err, resp, body) {
        process.nextTick(next);
        if (err) console.error(err);

        // eztv - initial - list of /shows/N
        if (Array.isArray(body) && body[0] && body[0].match("shows")) body.forEach(function(page) {
            queue.push(url.replace('/shows/', '/'+page));
        });

        // yts api - initial - /v2/list_movies.json
        if (body.status && body.data && body.data.movies) { 
            body.data.movies.forEach(indexMovie);

            // next page
            if (body.data.page_number * body.data.limit < body.data.movie_count) 
                queue.push(url.split("?")[0]+"?page="+(body.data.page_number+1));
        }

        console.log(url, body)
    });
}, 1);

var sources = require("./sources");
sources.yts.forEach(function(url) { queue.push(url) });
//sources.eztv.forEach(function(url) { queue.push(url) });

function indexMovie(movie) {
    //map[]
}

function indexShow(show) {

}
