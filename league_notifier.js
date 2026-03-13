const WebSocket = require("ws");
const fs = require("fs");
const https = require("https");
process.removeAllListeners('warning');
process.on('warning', () => {});

async function waitUntilLCUReady(port, auth) {
    return new Promise((resolve) => {
        const check = () => {
            const req = https.request({
                hostname: "127.0.0.1",
                port,
                path: "/lol-summoner/v1/current-summoner",
                method: "GET",
                headers: {
                    Authorization: `Basic ${auth}`},
                    rejectUnauthorized: false,
                },
                (res) => {
                    if (res.statusCode === 200)
                        resolve();
                    else {
                        //console.log(`LCU not ready yet (status ${res.statusCode})`);
                        setTimeout(check, 500);
                    }
                });
                req.on("error", () => setTimeout(check, 500));
                req.end();
            };
            check();
        });
}

async function getLockfileCredentials() {
    const LockfilePath = "C:/Riot Games/League of Legends/lockfile";
    const directory = "C:/Riot Games/League of Legends";

    if (!fs.existsSync(LockfilePath)) {
        console.log('No lockfile found, waiting for League to launch...');

        await new Promise((resolve) => {
            const watcher = fs.watch(directory, (eventType, filename) => {
                if (filename == "lockfile") {
                    console.log("Lockfile detected!");
                    watcher.close();
                    resolve();
                }
            })
        })
    }
    const content = fs.readFileSync(LockfilePath, "utf-8").trim();
    const [,,rawPort, rawPassword] = content.split(":");
    const port = rawPort;
    const auth = Buffer.from(`riot:${rawPassword}`).toString("base64");
    // console.log('port:', port);
    // console.log('auth:', auth);

    return { port, auth };
}

async function sendNotification(summonerName, gameMode) {
    //console.log("summoner name in notification: ", summonerName);
    fetch('https://ntfy.sh/lol-invitation', {
        method: 'POST',
        headers: {
            title: 'League of Legends',
            priority: 5,
            tags: 'video_games',
        },
        body: `Invitation received from ${summonerName} for ${gameMode}! 🎮`
    })
}

async function connectToLeague(port, auth) {
    console.log('\x1b[35m╔════════════════════════════════════╗');
    console.log('║   League Invite Notifier  🎮        ║');
    console.log('╚════════════════════════════════════╝\x1b[0m\n');
    console.log(`\x1b[90mConnecting to League of Legends client on port \x1b[1m${port}\x1b[0m\ ...`);
    console.log(`\x1b[90m  ntfy topic  :\x1b[0m lol-invitation`);
    console.log(`\x1b[90m  port        :\x1b[0m ${port}`);
    console.log(`\x1b[90m  status      :\x1b[0m Connecting...\n`);

    return new Promise((resolve) => {
        const ws = new WebSocket(`wss://127.0.0.1:${port}`, {
            headers: { Authorization: `Basic ${auth}` },
            rejectUnauthorized: false
        });

        ws.on("open", () => {
            console.log("\x1b[32mConnected!\x1b[0m\nListening for party invites...\n");
            ws.send(JSON.stringify([5, "OnJsonApiEvent"]));
        });

        ws.on("error", (e) => {
            console.log("Connection error: ", e.message);
        });

        ws.on("close", () => {
            console.log("League client closed.");
            resolve();
        })

        ws.on("message", async (raw) => {
            let msg;

            try {

            msg = JSON.parse(raw.toString());
            //console.log("Event received: ", msg[0]);

            } catch (e) {
                return;
            }
                
            if (!Array.isArray(msg))
                return;
            
            const [,, payload] = msg;

            //console.log("Event name: ", eventName);
            //console.log("URI", JSON.stringify(payload?.uri));
            
            if (payload?.uri !== "/lol-lobby/v2/received-invitations") 
            return;
            
            //console.log("invitation payload: ", payload);

            if (!Array.isArray(payload.data) || payload.data.length === 0)
                return;

            const summonerName = await getSummonerName(payload.data[0].fromSummonerId, port, auth);
            const gameMode = payload.data[0]?.gameConfig?.gameMode && 'a game';
            // const summonerName = 'Karina';
            // const gameMode = payload.data[0]?.gameConfig?.gameMode ?? 'a game';
            //console.log("result: ", summonerName + ' - ' + gameMode);
            const date = new Date().toLocaleString();
            console.log(`\x1b[34m[${date}] Invitation received from ${summonerName} for ${gameMode}. Sending message...\x1b[0m`);
            await sendNotification(summonerName, gameMode);
        });
    });
        
}

async function getSummonerName(summonerId, port, auth) {
    return new Promise((resolve) => {
        const req = https.request(
            {
                hostname: "127.0.0.1",
                port: port,
                path: `/lol-summoner/v1/summoners/${summonerId}`,
                method: "GET",
                headers: { Authorization: `Basic ${auth}` },
                rejectUnauthorized: false,
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    const summoner = JSON.parse(data);
                    const name = summoner.gameName
                        ? `${summoner.gameName}`
                        : `Summoner #${summonerId}`;
                    //console.log("summoner name: ", name);
                    resolve(name);
                });
            }
        );
        req.on("error", (e) => {
            console.error("Failed to fetch summoner:", e.message);
            resolve(`Summoner #${summonerId}`);
        });
        req.end();
    });
}

async function start() {
    console.clear();

    while (true) {
        try {
            
            const { port, auth } = await getLockfileCredentials();
            
            await waitUntilLCUReady(port, auth);
//            await new Promise(r => setTimeout(r, 1000));


            await connectToLeague(port, auth);
            
        } catch {
            console.log("Disconnected from League, waiting for restart...");
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }
}


start();