var stremio = require("stremio-addons");
var _ = require("lodash");
var async = require("async");
var needle = require("needle");
var fs = require('fs');
var magnet = require('magnet-uri');
var path = require('path');

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
var cachePath = path.join(process.env.HOME || require("os").tmpdir(), "popcorn-cache.json");
var map = { };
try { map = JSON.parse(fs.readFileSync(cachePath).toString()) } catch(e) { console.error("non-fatal( cache)", e) }
console.log("-> map has "+Object.keys(map).length+" movies / eps");

var addon = new stremio.Server({
    // TODO intercept meta.find so we can change the catalogues too

    "stream.find": function(args, callback, user) {
        if (! args.query) return callback();

        var isEp = args.query.hasOwnProperty('season');
        var hash = (isEp ? [args.query.imdb_id, args.query.season, args.query.episode] : [args.query.imdb_id]).join(" ");

        // WARNING: TODO:  eztv can be on-demand instead of cached in map[]
        // just hit eztvEndpoint/show/ + query.imdb_id 

        callback(null, _.map(map[hash] || [], function(infoHash, quality) { 
            return {
                infoHash: infoHash.toLowerCase(),
                tag: [quality].concat(quality == "1080p" ? ["hd"] : []).concat(isEp ? "eztv" : "yts"),
                name: isEp ? "EZTV" : "YTS",
                title: quality, 
                isFree: true,
                sources: [
                    'tracker:udp://tracker.leechers-paradise.org:6969/announce', 
                    'tracker:udp://tracker.pomf.se:80/announce', 'tracker:http://tracker.aletorrenty.pl:2710/announce',
                   // 'dht:'+infoHash // consider
                ],
                availability: 2 // todo: from seed/leech count
            }
        }));
    }
}, { secret: "8417fe936f0374fbd16a699668e8f3c4aa405d9f" }, manifest);

var server = require("http").createServer(function (req, res) {
    addon.middleware(req, res, function() { res.end() }); // wire the middleware - also compatible with connect / express
}).on("listening", function()
{
    console.log("Popcorn Addon listening on "+server.address().port);
}).listen(process.env.PORT || 7821);

/* COLLECT DATA
 */
var httpOpts = { 
    headers: { user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/28.0.1500.52 Chrome/28.0.1500.52 Safari/537.36" },
    json: true,
    open_timeout: 4000,
    timeout: 4000,
    read_timeout: 4000
};

var ezQueue = async.queue(collector, 1);
var ytsQueue = async.queue(collector, 1);
function collector(url, next) {
    console.log("-> collecting from "+url);
    needle.get(url, httpOpts, function(err, resp, body) {
        process.nextTick(next);
        if (err) console.error(err);

        // eztv - initial - list of /shows/N
        if (Array.isArray(body) && body[0] && typeof(body[0])=="string" && body[0].match("shows")) body.forEach(function(page) {
            ezQueue.push(url.replace('/shows/', '/'+page));
        });

        // eztv - shows listing
        if (Array.isArray(body) && body[0] && body[0].tvdb_id) body.reverse().forEach(function(show) {
            ezQueue.push(url.split('/shows')[0]+'/show/'+show._id);
        });

        // eztv - show
        if (body._id && body.imdb_id && body.tvdb_id) indexShow(body);

        // yts api - initial - /v2/list_movies.json
        if (body.status && body.data && body.data.movies) { 
            body.data.movies.forEach(indexMovie);

            // next page
            if (body.data.page_number * body.data.limit < body.data.movie_count) 
                ytsQueue.push(url.split("?")[0]+"?page="+(body.data.page_number+1));
        }
    });
}

var sources = require("./sources");
sources.yts.forEach(function(url) { ytsQueue.push(url) });
async.eachSeries(sources.eztv, function(url, cb) {
    console.log("-> eztv trying frm "+url);
    needle.get(url, httpOpts, function(err, resp, body) {
        if (body && body[0] && typeof(body[0])=="string") { console.log("-> eztv responded from "+url); ezQueue.push(url); cb(true); }
        else cb();
    });
}, function() {});

/* PUT DATA IN MAP
 */
function indexMovie(movie) {
    if(movie && Array.isArray(movie.torrents)) movie.torrents.forEach(function(t) {
        if (!map[movie.imdb_code]) map[movie.imdb_code] = { };
        map[movie.imdb_code][t.quality] = t.hash; // todo: other stuff
    });
}

function indexShow(show) {
    if (! (show && show.imdb_id && show.episodes && Array.isArray(show.episodes))) return;
    var imdb_id = show.imdb_id;
    
    show.episodes.forEach(function(ep) {
        var hash = imdb_id+" "+ep.season+" "+ep.episode;
        if (!map[hash]) map[hash] = { };

        _.each(ep.torrents, function(tor, quali) { 
            try {
                map[hash][quali] = magnet.decode(tor.url).infoHash
            } catch(e) { console.error('magnet.decode', e) }
        });
        var m = map[hash];
        if (m['0'] && (m['1080p'] == m['0'] || m['720p'] == m['0'] || m['480p'] == m['0'])) delete m['0'];
    });
}

// save to cache periodically
setInterval(function() {
    var start = Date.now();
    var n = Object.keys(map).length;
    fs.writeFile(cachePath, JSON.stringify(map), function(e) { if (e) console.error(e) });
    console.log("-> stringifying cache took "+(Date.now()-start)+"ms for "+n+" items");
}, 30*1000);

