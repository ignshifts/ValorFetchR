const { ValClient, LiveGame } = require("valclient.js");
const client = new ValClient();
const Table = require("table");
const Client = require("valorant-api-js");
const colors = require("colors");
const fs = require("fs");
const agents = require('./agents.json');

// 
const rankColorsJson = fs.readFileSync("./src/ranks.json");
const rankColors = JSON.parse(rankColorsJson);
const customColors = {
  Gray: (text) => `\x1b[90m${text}\x1b[0m`, // Gray
  Bronze: (text) => `\x1b[33m${text}\x1b[0m`, // Bronze (Yellow)
  Silver: (text) => `\x1b[36m${text}\x1b[0m`, // Silver (Cyan)
  Gold: (text) => `\x1b[33m${text}\x1b[0m`, // Gold (Yellow)
  Blue: (text) => `\x1b[34m${text}\x1b[0m`, // Blue
  Purple: (text) => `\x1b[35m${text}\x1b[0m`, // Purple (Magenta)
  Green: (text) => `\x1b[32m${text}\x1b[0m`, // Green
  Red: (text) => `\x1b[31m${text}\x1b[0m`, // Red
  Yellow: (text) => `\x1b[33m${text}\x1b[0m`, // Yellow
  Orange: (text) => `\x1b[38;5;202m${text}\x1b[0m`, // Orange
  Teal: (text) => `\x1b[38;5;31m${text}\x1b[0m`, // Teal
  Cyan: (text) => `\x1b[36m${text}\x1b[0m`, // Cyan
  White: (text) => `\x1b[37m${text}\x1b[0m`, // White
  "Light Blue": (text) => `\x1b[38;5;39m${text}\x1b[0m`, // Light Blue
  "Dark Blue": (text) => `\x1b[38;5;20m${text}\x1b[0m`, // Dark Blue
};

// States
// const ingame = require("./live.js");
// const pregame = require("./pregame.js");
// const menus = require("./menus.js");

client.init({ region: "na" }).then(async () => {
  const session = await client.session.current();
  if (session.cxnState === "CLOSED") {
    return console.log("VALORANT is closed, please open VALORANT.");
  }

  /**
   * @Listener Session State Listener
   */

  const EventEmitter = require("events");

  class SessionStateListener extends EventEmitter {
    constructor() {
      super();
      this.previousState = null;
    }
    watch(session, stateCallback) {
      const interval = setInterval(() => {
        client.session.current().then((currentState) => {
          const currentLoopState = currentState.loopState;
          if (currentLoopState !== this.previousState) {
            stateCallback(currentLoopState);
            this.previousState = currentLoopState;
          }
        });
      }, 1000);
      // Stop watching when the session is closed
      const closeCallback = () => {
        clearInterval(interval);
      };
      // Return the close callback to allow external cleanup if needed
      return closeCallback;
    }
  }
/**
 * @Menus Function
 */

    async function menus() {
        console.log('You are currently in the menus')
    
        const listener = new SessionStateListener();
    
    // Watch for state changes
    const closeCallback = listener.watch(session, async (newLoopState) => {
      // console.log('Loop state changed:', newLoopState);
    
      // Check if the new state is no longer MENUS
      if (newLoopState == 'PREGAME') {
        closeCallback();
        await pregame()
      } else if(newLoopState == 'INGAME') {
          closeCallback();
          await ingame()
      }    
    });
    }
/**
 * @PreGame Function
 */

async function pregame() {
  const listener = new SessionStateListener();

  const closeCallback = listener.watch(session, async (newLoopState) => {

    if (newLoopState == "MENUS") {
      closeCallback();
      await menus();
    } else if (newLoopState == "INGAME") {
      closeCallback();
      await ingame();
    } else if (newLoopState == "PREGAME") {

    const data = await client.pre_game.details();
    const players = data.AllyTeam;
    console.log(players.Players.length);
    const teamID = players.TeamID;
  
    const playersExtracted = players.Players.map(
      ({ Subject, CharacterID, PlayerIdentity }) => [
        Subject,
        teamID,
        CharacterID,
        PlayerIdentity.AccountLevel,
      ]
    );

    const playersExtractedPuuids = playersExtracted.map((player) => player[0]);

    /**
     *
     * @notation Valorant-Api.com API but with a Wrapper because I'm too lazy to use fetch/axios
     */
  
    const apiClient = new Client();
    const allAgents = await apiClient.getAgents();
    const compTiers = await apiClient.getCompetitiveTiers();
  
    const rankData = {};
    const lastObject = compTiers.data[compTiers.data.length - 1];
    lastObject.tiers.forEach((tier) => {
      if (tier.tierName == "Unused1") return;
      if (tier.tierName == "Unused2") return;
      rankData[tier.tier] = tier.tierName;
    });
    const characterData = {};
    allAgents.data.forEach((agent) => {
      characterData[agent.uuid] = agent.displayName;
    });

    const p = await client.chat.getAllParticipants()
    const AllPlayers = p.participants;
    const filteredPlayers = AllPlayers.filter(
      (player, index) =>
        AllPlayers.findIndex((p) => p.puuid[0] === player.puuid[0]) === index
    );

    const filtered = filteredPlayers.filter((player) =>
  playersExtractedPuuids.includes(player.puuid)
  );


    const extractedData = filtered.map(
      ({ game_name, game_tag, puuid }) => [`${game_name}#${game_tag}`, puuid]
    );
    playersExtracted.forEach(([subject, teamID, characterID, accountLevel]) => {
      const index = extractedData.findIndex(([_, puuid]) => puuid === subject);
  
      if (index !== -1) {
        extractedData[index] = [
          ...extractedData[index],
          teamID,
          characterID,
          accountLevel,
        ];
      }
    });
  
    /**
               Change CharacterID to CharacterName / Real Agent Name
               */


    extractedData.forEach((row) => {
      const characterID = row[3];
  
      if (characterData.hasOwnProperty(characterID)) {
        const displayName = characterData[characterID];
        row[3] = displayName; // Replace the characterID with the displayName
      }
    });
  
    const mmrPromises = extractedData.map(async ([, puuid, , ,]) => {
      const mmrData = await client.pvp.mmr(puuid);
      return mmrData;
    });
  
    const mmrDataArray = await Promise.all(mmrPromises);
  
    const mmrData = {};
    mmrDataArray.forEach((data) => {
      const Subject = data.Subject;
      const comp_data = data.QueueSkills.competitive.SeasonalInfoBySeasonID;
      if (comp_data && typeof comp_data === "object") {
        for (const [, details] of Object.entries(comp_data)) {
          const { CompetitiveTier, RankedRating } = details;
  
          // console.log(Subject, CompetitiveTier, RankedRating)
  
          if (!mmrData.hasOwnProperty(Subject)) {
            const rank = rankData[CompetitiveTier];
            mmrData[Subject] = { rank, rr: RankedRating };
          }
        }
      } else {
        return;
      }
    });
  
    extractedData.forEach((row) => {
      const puuid = row[1];
      // check if the puuid exists in mmrData
      if (mmrData.hasOwnProperty(puuid)) {
        // If it does, then add the rank and rr to the row
        const { rank, rr } = mmrData[puuid];
        row[5] = rank;
        row[6] = rr;
      }
    });
    const tableHeaders = [
      "Team",
      "Agent",
      "Name",
      "Rank",
      "RR",
      "Level",
      "PUUID",
    ];
  
  
    const agentColors = {};
    agents.agents.forEach(agent => {
      agentColors[agent.name.toUpperCase()] = agent.color;
    });
    
    const tableData = extractedData.map(([name, puuid, team, agent, level]) => {
      const mmrDataEntry = mmrData[puuid];
      const rank = mmrDataEntry ? mmrDataEntry.rank.toUpperCase() : "";
      const rr = mmrDataEntry ? mmrDataEntry.rr : "";
    
      let coloredName = name; // Default to name
      let coloredTeam = team;
    
      if (team === "Blue") {
        coloredName = customColors.Blue(name);
        coloredTeam =  customColors.Blue("Defenders");
      } else if (team === "Red") {
        coloredName = customColors.Red(name);
        coloredTeam = customColors.Red("Attackers");
      }
    
      const rankColor = rankColors[rank] || "White";
      const coloredRank = customColors[rankColor](rank);
    
      const agentColor = agentColors[agent.toUpperCase()] || "White";
      const coloredAgent = customColors[agentColor](agent);
      return [coloredTeam, coloredAgent, coloredName, coloredRank, rr, level, puuid];
    });
   

    //Same Team Grouping
    tableData.sort((a, b) => {
      const teamA = a[0];
      const teamB = b[0];
      if (teamA < teamB) return -1;
      if (teamA > teamB) return 1;
      return 0;
    });
    
    // const table = [tableHeaders, ...tableData];
    // const output = Table.table(table);
const table = [tableHeaders, ...tableData];
const config = {
  header: {
    alignment: 'center',
    content: `\x1b[36mPre Game\x1b`,
  },
}

const output = Table.table(table, config);

    console.log(output);
  
    const listener = new SessionStateListener();
  
    // Watch for state changes
    const closeCallback = listener.watch(session, async (newLoopState) => {
      // console.log("Loop state changed:", newLoopState);
  
      // Check if the new state is no longer MENUS
      if (newLoopState == "MENUS") {
        closeCallback();
        await menus();
      } else if (newLoopState == "INGAME") {
        closeCallback();
        await ingame();
      }
    });
}
  });
}

/**
 * @InGame Function
 */

async function ingame() {
  const data = await client.live_game.details();
  const players = data.Players;
  console.log(players.length);
  const playersExtracted = players.map(
    ({ Subject, TeamID, CharacterID, PlayerIdentity }) => [
      Subject,
      TeamID,
      CharacterID,
      PlayerIdentity.AccountLevel,
    ]
  );
  const playersExtractedPuuids = playersExtracted.map((player) => player[0]);

  /**
   *
   * Valorant-Api.com API but with a Wrapper because I'm too lazy to use fetch/axios
   */

  const apiClient = new Client();
  const allAgents = await apiClient.getAgents();
  const compTiers = await apiClient.getCompetitiveTiers();

  const rankData = {};
  const lastObject = compTiers.data[compTiers.data.length - 1];
  lastObject.tiers.forEach((tier) => {
    if (tier.tierName == "Unused1") return;
    if (tier.tierName == "Unused2") return;
    rankData[tier.tier] = tier.tierName;
  });

  // console.log(rankData)

  const characterData = {};
  allAgents.data.forEach((agent) => {
    characterData[agent.uuid] = agent.displayName;
  });

  const p = await client.chat.getAllParticipants()
  const AllPlayers = p.participants;
  const filteredPlayers = AllPlayers.filter(
    (player, index) => 
    
      AllPlayers.findIndex((p) => p.puuid === player.puuid) === index 
  );

  const filtered = filteredPlayers.filter((player) =>
  playersExtractedPuuids.includes(player.puuid)
);

  const extractedData = filtered.map(
    ({ game_name, game_tag, puuid }) => [`${game_name}#${game_tag}`, puuid]
  );
  playersExtracted.forEach(([subject, teamID, characterID, accountLevel]) => {
    const index = extractedData.findIndex(([_, puuid]) => puuid === subject);

    if (index !== -1) {
      extractedData[index] = [
        ...extractedData[index],
        teamID,
        characterID,
        accountLevel,
      ];
    }
  });


  /**
        Change CharacterID to CharacterName / Real Agent Name
         */
  extractedData.forEach((row) => {
    const characterID = row[3];

    if (characterData.hasOwnProperty(characterID)) {
      const displayName = characterData[characterID];
      row[3] = displayName; // Replace the characterID with the displayName
    }
  });

  const mmrPromises = extractedData.map(async ([, puuid, , ,]) => {
    const mmrData = await client.pvp.mmr(puuid);
    return mmrData;
  });

  const mmrDataArray = await Promise.all(mmrPromises);

  const mmrData = {};
  mmrDataArray.forEach((data) => {
    const Subject = data.Subject;
    const comp_data = data.QueueSkills.competitive.SeasonalInfoBySeasonID;
    if (comp_data && typeof comp_data === "object") {
      for (const [, details] of Object.entries(comp_data)) {
        const { CompetitiveTier, RankedRating } = details;

        // console.log(Subject, CompetitiveTier, RankedRating)

        if (!mmrData.hasOwnProperty(Subject)) {
          const rank = rankData[CompetitiveTier];
          mmrData[Subject] = { rank, rr: RankedRating };
        }
      }
    } else {
      return;
    }
  });

  extractedData.forEach((row) => {
    const puuid = row[1];
    // check if the puuid exists in mmrData
    if (mmrData.hasOwnProperty(puuid)) {
      // If it does, then add the rank and rr to the row
      const { rank, rr } = mmrData[puuid];
      row[5] = rank;
      row[6] = rr;
    }
  });
  const tableHeaders = [
    "Team",
    "Agent",
    "Name",
    "Rank",
    "RR",
    "Level",
    "PUUID",
  ];

  const agentColors = {};
  agents.agents.forEach(agent => {
    agentColors[agent.name.toUpperCase()] = agent.color;
  });
  
  const tableData = extractedData.map(([name, puuid, team, agent, level]) => {
    const mmrDataEntry = mmrData[puuid];
    const rank = mmrDataEntry ? mmrDataEntry.rank.toUpperCase() : "";
    const rr = mmrDataEntry ? mmrDataEntry.rr : "";
  
    let coloredName = name; // Default to name
    let coloredTeam = team;
  
    if (team === "Blue") {
      coloredName = customColors.Blue(name);
      coloredTeam =  customColors.Blue("Defenders");
    } else if (team === "Red") {
      coloredName = customColors.Red(name);
      coloredTeam = customColors.Red("Attackers");
    }
  
    const rankColor = rankColors[rank] || "White";
    const coloredRank = customColors[rankColor](rank);
  
    const agentColor = agentColors[agent.toUpperCase()] || "White";
    const coloredAgent = customColors[agentColor](agent);
    return [coloredTeam, coloredAgent, coloredName, coloredRank, rr, level, puuid];
  });

  // Same Team Grouping
  tableData.sort((a, b) => {
    const teamA = a[0];
    const teamB = b[0];
    if (teamA < teamB) return -1;
    if (teamA > teamB) return 1;
    return 0;
  });

  const table = [tableHeaders, ...tableData];
  const config = {
    header: {
      alignment: 'center',
      content: `\x1b[31mLive Game\x1b[0m`,
    },
  }
  const output = Table.table(table, config);
  
  console.log(output);

  const listener = new SessionStateListener();

  // Watch for state changes
  const closeCallback = listener.watch(session, async (newLoopState) => {
    // console.log("Loop state changed:", newLoopState);

    // Check if the new state is no longer MENUS
    if (newLoopState == "MENUS") {
      closeCallback();
      await menus();
    }
  });
}


  if (session.loopState === "MENUS") {
    await menus();
  } else if (session.loopState == "PREGAME") {
    await pregame();
    setInterval(pregame, 35000);
  } else if (session.loopState == "INGAME") {
    await ingame();
  }
});
