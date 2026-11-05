const { pool } = require("./db");

// Seed content is copied from the club's real repo (Jemimahosei/CornellSOUP,
// kept in full at soup-website/reference-repo/): index.html,
// past-events.html, upcoming-events.html, join-us.html,
// design-plan/text-content.md, design-plan/SOUP-provided-content/text-content.txt,
// design-plan/design-journey.md (client meeting minutes + goals).
// Nothing here is invented. Judgment calls, all documented:
//  - Member count differs across the club's own materials: live site says
//    over 400, first client meeting says 450+, provided text says 500+.
//    The live published site (400+) is used.
//  - Founded 2020 everywhere except design-plan/text-content.md (2019);
//    the live site + provided text + meeting minutes all say 2020.
//  - One typo in the source is fixed: "jumping into is" -> "jumping into it"
//    (Leaf Pile). The "furthur" typo in the Manhunt dropdown is likewise
//    spelled "further".
//  - Dates are the real dates from the repo. The two dated events are
//    from 2024, so the upcoming list is honestly empty until the club
//    posts new dates via Admin. Manhunt has no date in the repo, so it
//    lives as a resource (story), not a dated event.
//  - The live site says "Founded in 2020 / over 400 members / Since
//    2020". The design doc says 2019; the live site wins.
//  - No spot counts: the real site signs people up via GroupMe/email,
//    so spots_total/spots_taken stay NULL (the UI hides them).

const events = [
  {
    title: "161 Things to Do at Cornell Competition 2024",
    description:
      "We've adapted the class 161 Things Every Cornellian Should Do Before Graduating list into a version that is theoretically possible to do in one day.\n\nOn Friday, April 26th, 2024, 30+ teams will compete to see who can do the most things on the list in one day. If you have any questions, or if you're interested in joining the competition, please reach out to us!\n\nFull list: https://cornellsun.com/161-things-every-cornellian-should-do/",
    location: "Cornell campus",
    event_date: "2024-04-26",
    start_time: null,
    end_time: null,
    category: "competition",
    difficulty: "easy",
    spots_total: null,
    spots_taken: 0,
    image_url: "/images/161-things2.jpg",
  },
  {
    title: "Capture the Flag 2024",
    description:
      "If spending 24+ hours bushwhacking through forests, cooking over a fire, getting little to no sleep, standing guard in the pitch dark, and meeting a whole bunch of other crazy people sounds like fun to you, then congratulations, 24-hour capture the flag may be right for you! Please get in touch with us if you would like to join the game!\n\nThe fourth annual game of 24-hour Capture the Flag will be taking place over Labor Day weekend (August 31st, 2024 - September 1st, 2024).",
    location: "Sugar Hill State Forest",
    event_date: "2024-08-31",
    start_time: null,
    end_time: null,
    category: "game",
    difficulty: "easy",
    spots_total: null,
    spots_taken: 0,
    image_url: "/images/ctf3.jpg",
  },
];

const resources = [
  {
    title: "The Big Leaf Pile",
    category: "story",
    description:
      "SOUP's annual October tradition in Danby State Forest.",
    body: "The Big Leaf Pile is an annual event that has been put on by SOUP since the fall of 2021. Each year on some sunny weekend day in October, a group of SOUP members get together in Danby State Forest (about a 20 minute car ride from Cornell), bearing their largest rakes and their most tick-proof clothing. They then commence building a huge leaf pile and spend the rest of the day jumping into it from as high a height as possible.",
    image_url: "/images/leaf-pile3-tt.jpg",
  },
  {
    title: "Burn Night",
    category: "story",
    description: "Will it burn? That was the central question of Burn Night.",
    body: "Will it burn? That was the central question of Burn Night. Some people brought old class notes to burn for catharsis, some brought broken furniture to burn because it's cheaper than going to the dump, some brought rocks because they clearly didn't know how burning works. The crowning achievement of the night was dropping a can of wax into the fire and watching it explode into a fireball. Don't worry though; no people, animals, or plants were harmed in the making of Burn Night.",
    image_url: "/images/fire2-tt.jpg",
  },
  {
    title: "Snowball Fight",
    category: "story",
    description: "Sometimes SOUP even hosts snowball fights in the middle of August.",
    body: "Cornell rarely opts for a snow day, but when it does, you can be sure that SOUP will take full advantage of that. Even when there's no snow day, sometimes SOUP hosts snowball fights with the snow from outside of Lynah rink! This snow is there all year round, so sometimes SOUP even hosts snowball fights in the middle of August!",
    image_url: "/images/snowball-fight12.jpg",
  },
  {
    title: "Camping with SOUP",
    category: "story",
    description:
      "Impromptu weekend camping trips — gourmet food, a big bonfire, and a designated wilderness-medicine 'EMT' on every trip.",
    body: "One of the most common events that SOUP hosts is camping trips. Many members of SOUP crave the outdoors constantly, so it is common for impromptu camping trips to happen on a weekend with little planning. Some of the benefits of joining a camping trip hosted by SOUP is that you can count on gourmet food, a big bonfire, any camping gear you might need, and a perfect camping spot complete with beautiful views. In addition, SOUP always has a designated \"EMT\" (not certified as an EMT, but they are trained in wilderness medicine) to accompany every trip and event.",
    image_url: "/images/camping2-tt.jpg",
  },
  {
    title: "24-Hour Capture the Flag",
    category: "story",
    description:
      "SOUP's 24-hour game, every Labor Day weekend since 2021 in Sugar Hill State Forest.",
    body: "SOUP's 24-hour game of Capture the Flag has taken place every Labor Day weekend since 2021. This game takes place in the Sugar Hill State Forest, about an hour away from Ithaca. Some call it crazy, but those who've chosen to participate understand the magic that is 24-hour Capture the Flag. Each game holds new surprises, unexpected challenges, deep connections, and too much fun to handle!",
    image_url: "/images/ctf6-tt.jpg",
  },
  {
    title: "Manhunt — SOUP's campus-wide game",
    category: "story",
    description:
      "One person hides somewhere on campus; their location is sent to everyone every ten minutes.",
    body: "At SOUP, we play the classic game of manhunt a little differently. In our version (adapted from a Dutch game called Hunting Season), one person hides somewhere on Cornell's campus and their location is sent to the rest of the players every ten minutes. The first player to find the person wins. We take this game all over campus, and the only rules are that the person who's trying not to be caught is not allowed to go into anywhere with limited keycard access. Other than that, anything goes!\n\nIf you'd like to play, please get in touch with us and we'll let you know when the next game is happening! There will be further details communicated in the event flyers.",
    image_url: "/images/manhunt2.jpg",
  },
  {
    title: "Poem: The Leaf Pile",
    category: "poem",
    description: "By Sydney Sill (SOUP member), inspired by the Big Leaf Pile.",
    body: "T'was the compelling cocoon of fall that did coax us in,\nWarm glow of orange crunches, red crackles, and yellow pops.\nEnamored with Earth, two hours we toiled for our mission,\nMere fractions of the trees' bounty we amassed without stops.\n'Til taller than us--and many times wide!--we did attain\nA crunchy cairn worthy of our foliage fane.\n\n'Round the shrine of our labors we gathered to admire\nUntil in our souls we felt the worship it did evoke.\nFrom the East we raced to jump in, blurry legs afire,\nFrom the West we dove, inserting between layers of oak.\nEven scaled branches above to courageously leap,\nPaying childhood joy as tribute to the mighty heap.\n\nIn the peaceful wake of our joy, to the mound we succumbed.\nInto our warm autumnal nest we tucked, burrowing deep.\nWe held hands in the center whilst together we chummed,\n\"This definitely isn't cult energy\" you could hear us peep.\nIt was here we laid, swaddled in nature's safe shroud,\n'Til one by one, our phones with Cornell Alerts did buzz aloud.\n\n— Sydney Sill (SOUP member)",
  },
  {
    title: "Poem: 24 Hours of Capture the Flag",
    category: "poem",
    description:
      "By Willem Van Osselaer (SOUP member), the 24-hour game in seven parts.",
    body: "Part I - Capture the Flag.\nYou might have played capture the flag before, a common activity at school\nAnd this game was nothing out of the ordinary, except for just one rule\nThis game lasted not the usual hour or two\nBut from when the sun rose to when the sun arose anew\nNo stops, no halts, no breaks\nA full 24 hours of sprinting, stalking, and high stakes\n\nPart II - Misty Dawn.\nThe fourth of September, early morning\nSunny skies but clouds in background forming\nThirty three adventurers, a misty dawn on Sugar Hill\nIgnorant of the impending tests of will\nAt first some friendly mingling\nBut that is before the great partitioning\nOnce separated into red and blue\nTheir allegiance is not to friendship but to hue\nSeparate ways each team goes\nA narrow gorge forming the boundary between foes\nAway from a world of stress, school, spitter, spatter\nDown into a world were flags are all that matter\nRed camp high on a ridge where the wind blows\nBlue camp in a valley under the shadows\nWithout hesitation began the formation of strategy\nOf the best encroach on the enemy\nThen! the clock strikes mid-day\nThe game finally gets underway\n\nPart III - Stalemate.\nSprinting, scaling, tripping, falling\ndetermination meant no option of stalling\nThose who attack, close to the ground as they stalk\nThose who defend, eye on the woods like a hawk\nStealthy offensive advances\nvigilant defensive stances\nBut with flags remaining safely within their place\nNo team could edge out the other in this epic race\nHours of stealthy stalking went by\nAs the sun descended from the sky\n\nPart IV - Nightfall.\nBut whoever thought nightfall would keep each team on their respective side\nHad their suspicion quickly denied\nFaith in sight dismantled by a new moon\nWas replaced with the touch of feet on leaf, twig, and legume\nOn both sides people leapt into the forest, into the deep\nThe call of flag stronger than of sleep\nFor the guards, noises entering one ear\nBut no idea the enemy is near\nFor the enemy, heart dropping in fright\nEvery time the guard points into the forest with their light\nSuddenly. Contact! A guard's light hits an enemy's skin\nCommencing a dangerous chase to begin\nThroughout the night, between mouse's whisper and owl's hoot\nThis repeating cycle of hide, search, and pursuit\n\nPart V - The Final Stalk.\nBut, at thirty past three, in blue lands of West\nOccurred the move that would decide the rest\nA band of reds, into the blue valley they descend\nLittle did anyone know, the beginning of the end\nOn the cold forest bedrock\nThey crawl their stealthiest stalk\nThe blue camp's smoldering fire the only thing in their sight\nAs the rest is shrouded by night\nTraveling tangent to the blue team's campsite\nThey miraculously escape the enemy's light\n\nPart VI - Victory.\nHours through the dark woods they patrol\nAnd now they finally reach their ultimate goal\nThe flag! In the center of enemy land\nWhat was once a figment of dreams was now resting in their hand\nHalf past four, red camp, only illuminated by an occasional spark\nFour heroes appear from the depths of dark\nHolding up high their newly captured treasure\nTo some just a cloth, but to them a value impossible to measure\nAs the sun crawled over the horizon and returned its shine\nThe game was decided after twenty four hours of time\n\nPart VII - Memories.\nFrom the outside, capture the flag might seem kind of lame\nBut in the moment, it was much more than just a game\nThrough darkness, and cold, and rain\neveryone kept their full determination without restrain\nMaddie and I have been planning adventures together for quite some time\nBut this one will forever be a favorite of mine\nThe thirty three adventurers who had set out one full earth's rotation before\nNow have an experience they can forever adore\nAll those glowing faces, even if they were scratched and covered with sweat\nThey are something that I will never forget\nTo all those adventurers who participated in this struggle of hue\nAll I want to say, is thank you\n\n— Willem Van Osselaer (SOUP member)",
  },
  {
    title: "How to pitch your own SOUP event",
    category: "guide",
    description:
      "Have an idea? SOUP wants it — and will support you in running it.",
    body: "If you have an idea for an event that you want SOUP to put on, or if you even want to plan an event and want SOUP's support, please reach out to us at soup_cu@gmail.com.\n\nIf there's anything else you'd like to get in touch with SOUP leadership about, please send us an email and we'll get back to you shortly.",
  },
  {
    title: "Join the SoupMe (SOUP GroupMe)",
    category: "link",
    description:
      "This is where we drop specific information (rules, updates, etc.) about upcoming events.",
    url: "https://web.groupme.com/join_group/76748584/IpJpxdYO",
  },
  {
    title: "SOUP on Instagram",
    category: "link",
    description: "Follow @cornell__soup for photos and updates.",
    url: "https://www.instagram.com/cornell__soup",
  },
  {
    title: "How SOUP started — in the club's own words",
    category: "story",
    description:
      "The club's own account of its founding (written in 2024): four sophomore roommates, one all-nighter, and a 24-hour game of capture the flag.",
    body: "SOUP was founded in 2020 by four bored, covid-constrained sophomore roommates who shared a love of adventure, a need for nature, and a fondness for a little bit of organized chaos. In one all-nighter, SOUP went from a vague idea to an actual organization with social media accounts, a leadership team, a logo, and a mission. Just a few months after its founding, SOUP was hosting their first ever annual game of 24-hour capture the flag. Ever since then, SOUP has had a dedicated following. SOUP puts on 10+ events every year, each time with a robust turnout. Through its four years of existence, SOUP has created friendships, romances, rivalries, and a whole lot of fun.",
  },
  {
    title: "Suggest an idea — and join the leadership",
    category: "guide",
    description:
      "SOUP always welcomes new leaders — there is no official leadership, just whoever wants to put on an event.",
    body: "To suggest an idea for an event that you'd like SOUP to put on, please reach out to us at soup_cu@gmail.com. We'd be happy to hear your ideas, and we always welcome new leaders!",
  },
];

const announcements = [
  {
    title: "Welcome to SOUP — Students for Outdoor Unsupervised Playtime",
    body: "Welcome to SOUP - Students for Outdoor Unsupervised Playtime! We are a vibrant group of Cornell University students dedicated to making the most of the scenic beauty and open spaces around Ithaca. Our mission is to foster community and active lifestyles through fun, unsupervised outdoor events. Join us for a range of activities from capture the flag and games of sardines to snowball fights and camping trips. Whether you're looking to relive childhood games or just enjoy the great outdoors with fellow students, SOUP is your go-to club for adventure and connection in nature. Let's play outside!",
    pinned: true,
  },
  {
    title: "Have an idea? Pitch your own SOUP event",
    body: "Members have the unique opportunity to suggest and participate in new events, ensuring a continually evolving and engaging lineup. If you have an idea for an event that you want SOUP to put on, or if you even want to plan an event and want SOUP's support, reach out to us at soup_cu@gmail.com.",
    pinned: true,
  },
  {
    title: "161 Things competition — 30+ teams, one day",
    body: "On Friday, April 26th, 2024, 30+ teams competed to see who could do the most things on the 161 Things list in one day. Thanks to everyone who played!",
    pinned: false,
  },
];

async function main() {
  const { rows: eCount } = await pool.query("SELECT COUNT(*)::int AS n FROM events");
  if (eCount[0].n === 0) {
    for (const e of events) {
      await pool.query(
        `INSERT INTO events (title, description, location, event_date, start_time, end_time, category, difficulty, spots_total, spots_taken, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [e.title, e.description, e.location, e.event_date, e.start_time, e.end_time, e.category, e.difficulty, e.spots_total, e.spots_taken, e.image_url || null]
      );
    }
    console.log(`Seeded ${events.length} events.`);
  } else {
    console.log(`Events already seeded (${eCount[0].n} rows), skipping.`);
  }

  const { rows: rCount } = await pool.query("SELECT COUNT(*)::int AS n FROM resources");
  if (rCount[0].n === 0) {
    for (const r of resources) {
      await pool.query(
        `INSERT INTO resources (title, category, description, url, body, image_url) VALUES ($1,$2,$3,$4,$5,$6)`,
        [r.title, r.category, r.description, r.url || null, r.body || "", r.image_url || null]
      );
    }
    console.log(`Seeded ${resources.length} resources.`);
  } else {
    console.log(`Resources already seeded (${rCount[0].n} rows), skipping.`);
  }

  const { rows: aCount } = await pool.query("SELECT COUNT(*)::int AS n FROM announcements");
  if (aCount[0].n === 0) {
    for (const a of announcements) {
      await pool.query(
        `INSERT INTO announcements (title, body, pinned) VALUES ($1,$2,$3)`,
        [a.title, a.body, a.pinned]
      );
    }
    console.log(`Seeded ${announcements.length} announcements.`);
  } else {
    console.log(`Announcements already seeded (${aCount[0].n} rows), skipping.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
