# pct-addon
popcorn time add-on for stremio; takes the same content as popcorn time

## What is this
Popcorn Time-inspired add-on for stremio, adds EZTV and YTS sources

## How to get?
Currently, there's no hosted version, so you have to host it yourself.
Get node.js, then do:
```bash
git clone https://github.com/JCB9090/pct-addon
cd pct-addon
npm install
node index
```

Then start stremio
```cmd
%LOCALAPPDATA%\Programs\LNV\Stremio\stremio.exe . --service=http://localhost:7821
```
Or  for mac
```bash
/Applications/Stremio.app/Contents/MacOS/Electron . --service=http://localhost:7821
```

And open a movie/episode available on YTS or EZTV, now you will see it in the available streams screen:


## Screenshot
![screenshot](screenshot/demo.png)


## HOw to help?
This add-on is pretty much complete, but if you find a bug, open an issue report.
**Please consider helping me host this so that it can be available for all stremio users easily!**
