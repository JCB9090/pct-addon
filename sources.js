module.exports = { 
  // must point to /shows/ endpoint
  eztv: [
  	"https://popcorntime.ws/api/eztv/shows/", 
  	"https://popcornwvnbg7jev.onion.to/shows/"
  ],

  // must point to /api/v2/list_movies.json
  yts: ["https://yts.ag/api/v2/list_movies.json" /*, "http://api.torrentsapi.com/api/v2/list_movies.json"*/ ] // torrents api might not be compat
}
