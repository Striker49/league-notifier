import WebSocket from "ws";
import fs from "fs";
import https from "https";

let port;
let auth;

function getLockfileCredentials() {
    const LockfilePath = "C:/Riot Games/League of Legends/lockfile";
    const content = fs.readFileSync(LockfilePath, "utf-8").trim();
    const [,,rawPort, rawPassword] = content.split(":");
    port = rawPort;
    auth = Buffer.from(`riot:${rawPassword}`).toString("base64");
}

async function sendNotification(summonerName, gameMode) {
    console.log("summoner name in notification: ", summonerName);
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

async function connectToLeague() {
    console.clear();
    console.log('\x1b[35m╔════════════════════════════════════╗');
    console.log('║   League Invite Notifier  🎮        ║');
    console.log('╚════════════════════════════════════╝\x1b[0m\n');
    console.log(`\x1b[90m  ntfy topic  :\x1b[0m lol-invitation`);
    console.log(`\x1b[90m  port        :\x1b[0m ${port}`);
    console.log(`\x1b[90m  status      :\x1b[0m Connecting...\n`);

    console.log(`\x1b[90mConnecting to League of Legends client on port \x1b[1m${port}\x1b[0m\ ...`);

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

        const summonerName = await getSummonerName(payload.data[0].fromSummonerId);
        const gameMode = payload.data[0].gameConfig?.gameMode && 'a game';
        // const summonerName = 'Karina';
        // const gameMode = payload.data[0]?.gameConfig?.gameMode ?? 'a game';
        console.log("result: ", summonerName + ' - ' + gameMode);

        console.log("Invitation received. Sending message...");
        await sendNotification(summonerName, gameMode);
    });
        
}

async function getSummonerName(summonerId) {
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
                    console.log("summoner name: ", name);
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

getLockfileCredentials();

connectToLeague();