// Dicionário Oficial 100% Exato de Pokémon Red (pret/pokered)
const INTERNAL_TO_POKEMON = {
  "1": {
    "name": "Rhydon",
    "dex": 112,
    "types": [
      "Ground",
      "Rock"
    ],
    "baseHp": 105
  },
  "2": {
    "name": "Kangaskhan",
    "dex": 115,
    "types": [
      "Normal"
    ],
    "baseHp": 105
  },
  "3": {
    "name": "Nidoran♂",
    "dex": 32,
    "types": [
      "Poison"
    ],
    "baseHp": 46
  },
  "4": {
    "name": "Clefairy",
    "dex": 35,
    "types": [
      "Normal"
    ],
    "baseHp": 70
  },
  "5": {
    "name": "Spearow",
    "dex": 21,
    "types": [
      "Normal",
      "Flying"
    ],
    "baseHp": 40
  },
  "6": {
    "name": "Voltorb",
    "dex": 100,
    "types": [
      "Electric"
    ],
    "baseHp": 40
  },
  "7": {
    "name": "Nidoking",
    "dex": 34,
    "types": [
      "Poison",
      "Ground"
    ],
    "baseHp": 81
  },
  "8": {
    "name": "Slowbro",
    "dex": 80,
    "types": [
      "Water",
      "Psychic"
    ],
    "baseHp": 95
  },
  "9": {
    "name": "Ivysaur",
    "dex": 2,
    "types": [
      "Grass",
      "Poison"
    ],
    "baseHp": 60
  },
  "10": {
    "name": "Exeggutor",
    "dex": 103,
    "types": [
      "Grass",
      "Psychic"
    ],
    "baseHp": 95
  },
  "11": {
    "name": "Lickitung",
    "dex": 108,
    "types": [
      "Normal"
    ],
    "baseHp": 90
  },
  "12": {
    "name": "Exeggcute",
    "dex": 102,
    "types": [
      "Grass",
      "Psychic"
    ],
    "baseHp": 60
  },
  "13": {
    "name": "Grimer",
    "dex": 88,
    "types": [
      "Poison"
    ],
    "baseHp": 80
  },
  "14": {
    "name": "Gengar",
    "dex": 94,
    "types": [
      "Ghost",
      "Poison"
    ],
    "baseHp": 60
  },
  "15": {
    "name": "Nidoran♀",
    "dex": 29,
    "types": [
      "Poison"
    ],
    "baseHp": 55
  },
  "16": {
    "name": "Nidoqueen",
    "dex": 31,
    "types": [
      "Poison",
      "Ground"
    ],
    "baseHp": 90
  },
  "17": {
    "name": "Cubone",
    "dex": 104,
    "types": [
      "Ground"
    ],
    "baseHp": 50
  },
  "18": {
    "name": "Rhyhorn",
    "dex": 111,
    "types": [
      "Ground",
      "Rock"
    ],
    "baseHp": 80
  },
  "19": {
    "name": "Lapras",
    "dex": 131,
    "types": [
      "Water",
      "Ice"
    ],
    "baseHp": 130
  },
  "20": {
    "name": "Arcanine",
    "dex": 59,
    "types": [
      "Fire"
    ],
    "baseHp": 90
  },
  "21": {
    "name": "Mew",
    "dex": 151,
    "types": ["Psychic"],
    "baseHp": 100
  },
  "22": {
    "name": "Gyarados",
    "dex": 130,
    "types": [
      "Water",
      "Flying"
    ],
    "baseHp": 95
  },
  "23": {
    "name": "Shellder",
    "dex": 90,
    "types": [
      "Water"
    ],
    "baseHp": 30
  },
  "24": {
    "name": "Tentacool",
    "dex": 72,
    "types": [
      "Water",
      "Poison"
    ],
    "baseHp": 40
  },
  "25": {
    "name": "Gastly",
    "dex": 92,
    "types": [
      "Ghost",
      "Poison"
    ],
    "baseHp": 30
  },
  "26": {
    "name": "Scyther",
    "dex": 123,
    "types": [
      "Bug",
      "Flying"
    ],
    "baseHp": 70
  },
  "27": {
    "name": "Staryu",
    "dex": 120,
    "types": [
      "Water"
    ],
    "baseHp": 30
  },
  "28": {
    "name": "Blastoise",
    "dex": 9,
    "types": [
      "Water"
    ],
    "baseHp": 79
  },
  "29": {
    "name": "Pinsir",
    "dex": 127,
    "types": [
      "Bug"
    ],
    "baseHp": 65
  },
  "30": {
    "name": "Tangela",
    "dex": 114,
    "types": [
      "Grass"
    ],
    "baseHp": 65
  },
  "31": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "32": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "33": {
    "name": "Growlithe",
    "dex": 58,
    "types": [
      "Fire"
    ],
    "baseHp": 55
  },
  "34": {
    "name": "Onix",
    "dex": 95,
    "types": [
      "Rock",
      "Ground"
    ],
    "baseHp": 35
  },
  "35": {
    "name": "Fearow",
    "dex": 22,
    "types": [
      "Normal",
      "Flying"
    ],
    "baseHp": 65
  },
  "36": {
    "name": "Pidgey",
    "dex": 16,
    "types": [
      "Normal",
      "Flying"
    ],
    "baseHp": 40
  },
  "37": {
    "name": "Slowpoke",
    "dex": 79,
    "types": [
      "Water",
      "Psychic"
    ],
    "baseHp": 90
  },
  "38": {
    "name": "Kadabra",
    "dex": 64,
    "types": [
      "Psychic"
    ],
    "baseHp": 40
  },
  "39": {
    "name": "Graveler",
    "dex": 75,
    "types": [
      "Rock",
      "Ground"
    ],
    "baseHp": 55
  },
  "40": {
    "name": "Chansey",
    "dex": 113,
    "types": [
      "Normal"
    ],
    "baseHp": 250
  },
  "41": {
    "name": "Machoke",
    "dex": 67,
    "types": [
      "Fighting"
    ],
    "baseHp": 80
  },
  "42": {
    "name": "Mr. Mime",
    "dex": 122,
    "types": [
      "Psychic"
    ],
    "baseHp": 40
  },
  "43": {
    "name": "Hitmonlee",
    "dex": 106,
    "types": [
      "Fighting"
    ],
    "baseHp": 50
  },
  "44": {
    "name": "Hitmonchan",
    "dex": 107,
    "types": [
      "Fighting"
    ],
    "baseHp": 50
  },
  "45": {
    "name": "Arbok",
    "dex": 24,
    "types": [
      "Poison"
    ],
    "baseHp": 60
  },
  "46": {
    "name": "Parasect",
    "dex": 47,
    "types": ["Bug","Grass"],
    "baseHp": 60
  },
  "47": {
    "name": "Psyduck",
    "dex": 54,
    "types": [
      "Water"
    ],
    "baseHp": 50
  },
  "48": {
    "name": "Drowzee",
    "dex": 96,
    "types": [
      "Psychic"
    ],
    "baseHp": 60
  },
  "49": {
    "name": "Golem",
    "dex": 76,
    "types": [
      "Rock",
      "Ground"
    ],
    "baseHp": 80
  },
  "50": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "51": {
    "name": "Magmar",
    "dex": 126,
    "types": [
      "Fire"
    ],
    "baseHp": 65
  },
  "52": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "53": {
    "name": "Electabuzz",
    "dex": 125,
    "types": [
      "Electric"
    ],
    "baseHp": 65
  },
  "54": {
    "name": "Magneton",
    "dex": 82,
    "types": ["Electric"],
    "baseHp": 50
  },
  "55": {
    "name": "Koffing",
    "dex": 109,
    "types": [
      "Poison"
    ],
    "baseHp": 40
  },
  "56": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "57": {
    "name": "Mankey",
    "dex": 56,
    "types": [
      "Fighting"
    ],
    "baseHp": 40
  },
  "58": {
    "name": "Seel",
    "dex": 86,
    "types": [
      "Water"
    ],
    "baseHp": 65
  },
  "59": {
    "name": "Diglett",
    "dex": 50,
    "types": [
      "Ground"
    ],
    "baseHp": 10
  },
  "60": {
    "name": "Tauros",
    "dex": 128,
    "types": [
      "Normal"
    ],
    "baseHp": 75
  },
  "61": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "62": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "63": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "64": {
    "name": "Farfetch'd",
    "dex": 83,
    "types": [
      "Normal",
      "Flying"
    ],
    "baseHp": 52
  },
  "65": {
    "name": "Venonat",
    "dex": 48,
    "types": [
      "Bug",
      "Poison"
    ],
    "baseHp": 60
  },
  "66": {
    "name": "Dragonite",
    "dex": 149,
    "types": [
      "Dragon",
      "Flying"
    ],
    "baseHp": 91
  },
  "67": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "68": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "69": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "70": {
    "name": "Doduo",
    "dex": 84,
    "types": [
      "Normal",
      "Flying"
    ],
    "baseHp": 35
  },
  "71": {
    "name": "Poliwag",
    "dex": 60,
    "types": [
      "Water"
    ],
    "baseHp": 40
  },
  "72": {
    "name": "Jynx",
    "dex": 124,
    "types": [
      "Ice",
      "Psychic"
    ],
    "baseHp": 65
  },
  "73": {
    "name": "Moltres",
    "dex": 146,
    "types": [
      "Fire",
      "Flying"
    ],
    "baseHp": 90
  },
  "74": {
    "name": "Articuno",
    "dex": 144,
    "types": [
      "Ice",
      "Flying"
    ],
    "baseHp": 90
  },
  "75": {
    "name": "Zapdos",
    "dex": 145,
    "types": [
      "Electric",
      "Flying"
    ],
    "baseHp": 90
  },
  "76": {
    "name": "Ditto",
    "dex": 132,
    "types": [
      "Normal"
    ],
    "baseHp": 48
  },
  "77": {
    "name": "Meowth",
    "dex": 52,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "78": {
    "name": "Krabby",
    "dex": 98,
    "types": [
      "Water"
    ],
    "baseHp": 30
  },
  "79": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "80": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "81": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "82": {
    "name": "Vulpix",
    "dex": 37,
    "types": [
      "Fire"
    ],
    "baseHp": 38
  },
  "83": {
    "name": "Ninetales",
    "dex": 38,
    "types": [
      "Fire"
    ],
    "baseHp": 73
  },
  "84": {
    "name": "Pikachu",
    "dex": 25,
    "types": [
      "Electric"
    ],
    "baseHp": 35
  },
  "85": {
    "name": "Raichu",
    "dex": 26,
    "types": [
      "Electric"
    ],
    "baseHp": 60
  },
  "86": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "87": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "88": {
    "name": "Dratini",
    "dex": 147,
    "types": [
      "Dragon"
    ],
    "baseHp": 41
  },
  "89": {
    "name": "Dragonair",
    "dex": 148,
    "types": [
      "Dragon"
    ],
    "baseHp": 61
  },
  "90": {
    "name": "Kabuto",
    "dex": 140,
    "types": [
      "Rock",
      "Water"
    ],
    "baseHp": 30
  },
  "91": {
    "name": "Kabutops",
    "dex": 141,
    "types": ["Rock","Water"],
    "baseHp": 60
  },
  "92": {
    "name": "Horsea",
    "dex": 116,
    "types": [
      "Water"
    ],
    "baseHp": 30
  },
  "93": {
    "name": "Seadra",
    "dex": 117,
    "types": [
      "Water"
    ],
    "baseHp": 55
  },
  "94": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "95": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "96": {
    "name": "Sandshrew",
    "dex": 27,
    "types": [
      "Ground"
    ],
    "baseHp": 50
  },
  "97": {
    "name": "Sandslash",
    "dex": 28,
    "types": [
      "Ground"
    ],
    "baseHp": 75
  },
  "98": {
    "name": "Omanyte",
    "dex": 138,
    "types": [
      "Rock",
      "Water"
    ],
    "baseHp": 35
  },
  "99": {
    "name": "Omastar",
    "dex": 139,
    "types": [
      "Rock",
      "Water"
    ],
    "baseHp": 70
  },
  "100": {
    "name": "Jigglypuff",
    "dex": 39,
    "types": [
      "Normal"
    ],
    "baseHp": 115
  },
  "101": {
    "name": "Wigglytuff",
    "dex": 40,
    "types": [
      "Normal"
    ],
    "baseHp": 140
  },
  "102": {
    "name": "Eevee",
    "dex": 133,
    "types": [
      "Normal"
    ],
    "baseHp": 55
  },
  "103": {
    "name": "Flareon",
    "dex": 136,
    "types": [
      "Fire"
    ],
    "baseHp": 65
  },
  "104": {
    "name": "Jolteon",
    "dex": 135,
    "types": [
      "Electric"
    ],
    "baseHp": 65
  },
  "105": {
    "name": "Vaporeon",
    "dex": 134,
    "types": [
      "Water"
    ],
    "baseHp": 130
  },
  "106": {
    "name": "Machop",
    "dex": 66,
    "types": [
      "Fighting"
    ],
    "baseHp": 70
  },
  "107": {
    "name": "Zubat",
    "dex": 41,
    "types": [
      "Poison",
      "Flying"
    ],
    "baseHp": 40
  },
  "108": {
    "name": "Ekans",
    "dex": 23,
    "types": [
      "Poison"
    ],
    "baseHp": 35
  },
  "109": {
    "name": "Paras",
    "dex": 46,
    "types": [
      "Bug",
      "Grass"
    ],
    "baseHp": 35
  },
  "110": {
    "name": "Poliwhirl",
    "dex": 61,
    "types": [
      "Water"
    ],
    "baseHp": 65
  },
  "111": {
    "name": "Poliwrath",
    "dex": 62,
    "types": [
      "Water",
      "Fighting"
    ],
    "baseHp": 90
  },
  "112": {
    "name": "Weedle",
    "dex": 13,
    "types": [
      "Bug",
      "Poison"
    ],
    "baseHp": 40
  },
  "113": {
    "name": "Kakuna",
    "dex": 14,
    "types": [
      "Bug",
      "Poison"
    ],
    "baseHp": 45
  },
  "114": {
    "name": "Beedrill",
    "dex": 15,
    "types": [
      "Bug",
      "Poison"
    ],
    "baseHp": 65
  },
  "115": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "116": {
    "name": "Dodrio",
    "dex": 85,
    "types": [
      "Normal",
      "Flying"
    ],
    "baseHp": 60
  },
  "117": {
    "name": "Primeape",
    "dex": 57,
    "types": [
      "Fighting"
    ],
    "baseHp": 65
  },
  "118": {
    "name": "Dugtrio",
    "dex": 51,
    "types": [
      "Ground"
    ],
    "baseHp": 35
  },
  "119": {
    "name": "Venomoth",
    "dex": 49,
    "types": [
      "Bug",
      "Poison"
    ],
    "baseHp": 70
  },
  "120": {
    "name": "Dewgong",
    "dex": 87,
    "types": [
      "Water",
      "Ice"
    ],
    "baseHp": 90
  },
  "121": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "122": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "123": {
    "name": "Caterpie",
    "dex": 10,
    "types": [
      "Bug"
    ],
    "baseHp": 45
  },
  "124": {
    "name": "Metapod",
    "dex": 11,
    "types": [
      "Bug"
    ],
    "baseHp": 50
  },
  "125": {
    "name": "Butterfree",
    "dex": 12,
    "types": [
      "Bug",
      "Flying"
    ],
    "baseHp": 60
  },
  "126": {
    "name": "Machamp",
    "dex": 68,
    "types": [
      "Fighting"
    ],
    "baseHp": 90
  },
  "127": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "128": {
    "name": "Golduck",
    "dex": 55,
    "types": [
      "Water"
    ],
    "baseHp": 80
  },
  "129": {
    "name": "Hypno",
    "dex": 97,
    "types": [
      "Psychic"
    ],
    "baseHp": 85
  },
  "130": {
    "name": "Golbat",
    "dex": 42,
    "types": [
      "Poison",
      "Flying"
    ],
    "baseHp": 75
  },
  "131": {
    "name": "Mewtwo",
    "dex": 150,
    "types": [
      "Psychic"
    ],
    "baseHp": 106
  },
  "132": {
    "name": "Snorlax",
    "dex": 143,
    "types": [
      "Normal"
    ],
    "baseHp": 160
  },
  "133": {
    "name": "Magikarp",
    "dex": 129,
    "types": [
      "Water"
    ],
    "baseHp": 20
  },
  "134": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "135": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "136": {
    "name": "Muk",
    "dex": 89,
    "types": [
      "Poison"
    ],
    "baseHp": 105
  },
  "137": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "138": {
    "name": "Kingler",
    "dex": 99,
    "types": [
      "Water"
    ],
    "baseHp": 55
  },
  "139": {
    "name": "Cloyster",
    "dex": 91,
    "types": [
      "Water",
      "Ice"
    ],
    "baseHp": 50
  },
  "140": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "141": {
    "name": "Electrode",
    "dex": 101,
    "types": [
      "Electric"
    ],
    "baseHp": 60
  },
  "142": {
    "name": "Clefable",
    "dex": 36,
    "types": [
      "Normal"
    ],
    "baseHp": 95
  },
  "143": {
    "name": "Weezing",
    "dex": 110,
    "types": [
      "Poison"
    ],
    "baseHp": 65
  },
  "144": {
    "name": "Persian",
    "dex": 53,
    "types": [
      "Normal"
    ],
    "baseHp": 65
  },
  "145": {
    "name": "Marowak",
    "dex": 105,
    "types": [
      "Ground"
    ],
    "baseHp": 60
  },
  "146": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "147": {
    "name": "Haunter",
    "dex": 93,
    "types": [
      "Ghost",
      "Poison"
    ],
    "baseHp": 45
  },
  "148": {
    "name": "Abra",
    "dex": 63,
    "types": [
      "Psychic"
    ],
    "baseHp": 25
  },
  "149": {
    "name": "Alakazam",
    "dex": 65,
    "types": [
      "Psychic"
    ],
    "baseHp": 55
  },
  "150": {
    "name": "Pidgeotto",
    "dex": 17,
    "types": [
      "Normal",
      "Flying"
    ],
    "baseHp": 63
  },
  "151": {
    "name": "Pidgeot",
    "dex": 18,
    "types": ["Normal","Flying"],
    "baseHp": 83
  },
  "152": {
    "name": "Starmie",
    "dex": 121,
    "types": [
      "Water",
      "Psychic"
    ],
    "baseHp": 60
  },
  "153": {
    "name": "Bulbasaur",
    "dex": 1,
    "types": [
      "Grass",
      "Poison"
    ],
    "baseHp": 45
  },
  "154": {
    "name": "Venusaur",
    "dex": 3,
    "types": [
      "Grass",
      "Poison"
    ],
    "baseHp": 80
  },
  "155": {
    "name": "Tentacruel",
    "dex": 73,
    "types": [
      "Water",
      "Poison"
    ],
    "baseHp": 80
  },
  "156": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "157": {
    "name": "Goldeen",
    "dex": 118,
    "types": [
      "Water"
    ],
    "baseHp": 45
  },
  "158": {
    "name": "Seaking",
    "dex": 119,
    "types": [
      "Water"
    ],
    "baseHp": 80
  },
  "159": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "160": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "161": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "162": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "163": {
    "name": "Ponyta",
    "dex": 77,
    "types": [
      "Fire"
    ],
    "baseHp": 50
  },
  "164": {
    "name": "Rapidash",
    "dex": 78,
    "types": [
      "Fire"
    ],
    "baseHp": 65
  },
  "165": {
    "name": "Rattata",
    "dex": 19,
    "types": [
      "Normal"
    ],
    "baseHp": 30
  },
  "166": {
    "name": "Raticate",
    "dex": 20,
    "types": [
      "Normal"
    ],
    "baseHp": 55
  },
  "167": {
    "name": "Nidorino",
    "dex": 33,
    "types": [
      "Poison"
    ],
    "baseHp": 61
  },
  "168": {
    "name": "Nidorina",
    "dex": 30,
    "types": [
      "Poison"
    ],
    "baseHp": 70
  },
  "169": {
    "name": "Geodude",
    "dex": 74,
    "types": [
      "Rock",
      "Ground"
    ],
    "baseHp": 40
  },
  "170": {
    "name": "Porygon",
    "dex": 137,
    "types": [
      "Normal"
    ],
    "baseHp": 65
  },
  "171": {
    "name": "Aerodactyl",
    "dex": 142,
    "types": [
      "Rock",
      "Flying"
    ],
    "baseHp": 80
  },
  "172": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "173": {
    "name": "Magnemite",
    "dex": 81,
    "types": ["Electric"],
    "baseHp": 25
  },
  "174": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "175": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "176": {
    "name": "Charmander",
    "dex": 4,
    "types": [
      "Fire"
    ],
    "baseHp": 39
  },
  "177": {
    "name": "Squirtle",
    "dex": 7,
    "types": [
      "Water"
    ],
    "baseHp": 44
  },
  "178": {
    "name": "Charmeleon",
    "dex": 5,
    "types": [
      "Fire"
    ],
    "baseHp": 58
  },
  "179": {
    "name": "Wartortle",
    "dex": 8,
    "types": [
      "Water"
    ],
    "baseHp": 59
  },
  "180": {
    "name": "Charizard",
    "dex": 6,
    "types": [
      "Fire",
      "Flying"
    ],
    "baseHp": 78
  },
  "181": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "182": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "183": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "184": {
    "name": "Missingno.",
    "dex": 0,
    "types": [
      "Normal"
    ],
    "baseHp": 40
  },
  "185": {
    "name": "Oddish",
    "dex": 43,
    "types": [
      "Grass",
      "Poison"
    ],
    "baseHp": 45
  },
  "186": {
    "name": "Gloom",
    "dex": 44,
    "types": [
      "Grass",
      "Poison"
    ],
    "baseHp": 60
  },
  "187": {
    "name": "Vileplume",
    "dex": 45,
    "types": [
      "Grass",
      "Poison"
    ],
    "baseHp": 75
  },
  "188": {
    "name": "Bellsprout",
    "dex": 69,
    "types": [
      "Grass",
      "Poison"
    ],
    "baseHp": 50
  },
  "189": {
    "name": "Weepinbell",
    "dex": 70,
    "types": [
      "Grass",
      "Poison"
    ],
    "baseHp": 65
  },
  "190": {
    "name": "Victreebel",
    "dex": 71,
    "types": [
      "Grass",
      "Poison"
    ],
    "baseHp": 80
  }
};

const MAP_NAMES = {
  "0": "Pallet Town",
  "1": "Viridian City",
  "2": "Pewter City",
  "3": "Cerulean City",
  "4": "Lavender Town",
  "5": "Vermilion City",
  "6": "Celadon City",
  "7": "Fuchsia City",
  "8": "Cinnabar Island",
  "9": "Indigo Plateau",
  "10": "Saffron City",
  "11": "Unused Map 0b",
  "12": "Route 1",
  "13": "Route 2",
  "14": "Route 3",
  "15": "Route 4",
  "16": "Route 5",
  "17": "Route 6",
  "18": "Route 7",
  "19": "Route 8",
  "20": "Route 9",
  "21": "Route 10",
  "22": "Route 11",
  "23": "Route 12",
  "24": "Route 13",
  "25": "Route 14",
  "26": "Route 15",
  "27": "Route 16",
  "28": "Route 17",
  "29": "Route 18",
  "30": "Route 19",
  "31": "Route 20",
  "32": "Route 21",
  "33": "Route 22",
  "34": "Route 23",
  "35": "Route 24",
  "36": "Route 25",
  "37": "Reds House 1F",
  "38": "Reds House 2F",
  "39": "Blues House",
  "40": "Oaks Lab",
  "41": "Viridian Pokecenter",
  "42": "Viridian Mart",
  "43": "Viridian School House",
  "44": "Viridian Nickname House",
  "45": "Viridian Gym",
  "46": "Digletts Cave Route 2",
  "47": "Viridian Forest North Gate",
  "48": "Route 2 Trade House",
  "49": "Route 2 Gate",
  "50": "Viridian Forest South Gate",
  "51": "Viridian Forest",
  "52": "Museum 1F",
  "53": "Museum 2F",
  "54": "Pewter Gym",
  "55": "Pewter Nidoran House",
  "56": "Pewter Mart",
  "57": "Pewter Speech House",
  "58": "Pewter Pokecenter",
  "59": "Mt Moon 1F",
  "60": "Mt Moon B1F",
  "61": "Mt Moon B2f",
  "62": "Cerulean Trashed House",
  "63": "Cerulean Trade House",
  "64": "Cerulean Pokecenter",
  "65": "Cerulean Gym",
  "66": "Bike Shop",
  "67": "Cerulean Mart",
  "68": "Mt Moon Pokecenter",
  "69": "Cerulean Trashed House Copy",
  "70": "Route 5 Gate",
  "71": "Underground Path Route 5",
  "72": "Daycare",
  "73": "Route 6 Gate",
  "74": "Underground Path Route 6",
  "75": "Underground Path Route 6 Copy",
  "76": "Route 7 Gate",
  "77": "Underground Path Route 7",
  "78": "Underground Path Route 7 Copy",
  "79": "Route 8 Gate",
  "80": "Underground Path Route 8",
  "81": "Rock Tunnel Pokecenter",
  "82": "Rock Tunnel 1F",
  "83": "Power Plant",
  "84": "Route 11 Gate 1F",
  "85": "Digletts Cave Route 11",
  "86": "Route 11 Gate 2F",
  "87": "Route 12 Gate 1F",
  "88": "Bills House",
  "89": "Vermilion Pokecenter",
  "90": "Pokemon Fan Club",
  "91": "Vermilion Mart",
  "92": "Vermilion Gym",
  "93": "Vermilion Pidgey House",
  "94": "Vermilion Dock",
  "95": "Ss Anne 1F",
  "96": "Ss Anne 2F",
  "97": "Ss Anne 3F",
  "98": "Ss Anne B1F",
  "99": "Ss Anne Bow",
  "100": "Ss Anne Kitchen",
  "101": "Ss Anne Captains Room",
  "102": "Ss Anne 1F Rooms",
  "103": "Ss Anne 2F Rooms",
  "104": "Ss Anne B1F Rooms",
  "105": "Unused Map 69",
  "106": "Unused Map 6a",
  "107": "Unused Map 6b",
  "108": "Victory Road 1F",
  "109": "Unused Map 6d",
  "110": "Unused Map 6e",
  "111": "Unused Map 6f",
  "112": "Unused Map 70",
  "113": "Lances Room",
  "114": "Unused Map 72",
  "115": "Unused Map 73",
  "116": "Unused Map 74",
  "117": "Unused Map 75",
  "118": "Hall Of Fame",
  "119": "Underground Path North South",
  "120": "Champions Room",
  "121": "Underground Path West East",
  "122": "Celadon Mart 1F",
  "123": "Celadon Mart 2F",
  "124": "Celadon Mart 3F",
  "125": "Celadon Mart 4f",
  "126": "Celadon Mart Roof",
  "127": "Celadon Mart Elevator",
  "128": "Celadon Mansion 1F",
  "129": "Celadon Mansion 2F",
  "130": "Celadon Mansion 3F",
  "131": "Celadon Mansion Roof",
  "132": "Celadon Mansion Roof House",
  "133": "Celadon Pokecenter",
  "134": "Celadon Gym",
  "135": "Game Corner",
  "136": "Celadon Mart 5f",
  "137": "Game Corner Prize Room",
  "138": "Celadon Diner",
  "139": "Celadon Chief House",
  "140": "Celadon Hotel",
  "141": "Lavender Pokecenter",
  "142": "Pokemon Tower 1F",
  "143": "Pokemon Tower 2F",
  "144": "Pokemon Tower 3F",
  "145": "Pokemon Tower 4f",
  "146": "Pokemon Tower 5f",
  "147": "Pokemon Tower 6f",
  "148": "Pokemon Tower 7f",
  "149": "Mr Fujis House",
  "150": "Lavender Mart",
  "151": "Lavender Cubone House",
  "152": "Fuchsia Mart",
  "153": "Fuchsia Bills Grandpas House",
  "154": "Fuchsia Pokecenter",
  "155": "Wardens House",
  "156": "Safari Zone Gate",
  "157": "Fuchsia Gym",
  "158": "Fuchsia Meeting Room",
  "159": "Seafoam Islands B1F",
  "160": "Seafoam Islands B2f",
  "161": "Seafoam Islands B3f",
  "162": "Seafoam Islands B4f",
  "163": "Vermilion Old Rod House",
  "164": "Fuchsia Good Rod House",
  "165": "Pokemon Mansion 1F",
  "166": "Cinnabar Gym",
  "167": "Cinnabar Lab",
  "168": "Cinnabar Lab Trade Room",
  "169": "Cinnabar Lab Metronome Room",
  "170": "Cinnabar Lab Fossil Room",
  "171": "Cinnabar Pokecenter",
  "172": "Cinnabar Mart",
  "173": "Cinnabar Mart Copy",
  "174": "Indigo Plateau Lobby",
  "175": "Copycats House 1F",
  "176": "Copycats House 2F",
  "177": "Fighting Dojo",
  "178": "Saffron Gym",
  "179": "Saffron Pidgey House",
  "180": "Saffron Mart",
  "181": "Silph Co 1F",
  "182": "Saffron Pokecenter",
  "183": "Mr Psychics House",
  "184": "Route 15 Gate 1F",
  "185": "Route 15 Gate 2F",
  "186": "Route 16 Gate 1F",
  "187": "Route 16 Gate 2F",
  "188": "Route 16 Fly House",
  "189": "Route 12 Super Rod House",
  "190": "Route 18 Gate 1F",
  "191": "Route 18 Gate 2F",
  "192": "Seafoam Islands 1F",
  "193": "Route 22 Gate",
  "194": "Victory Road 2F",
  "195": "Route 12 Gate 2F",
  "196": "Vermilion Trade House",
  "197": "Digletts Cave",
  "198": "Victory Road 3F",
  "199": "Rocket Hideout B1F",
  "200": "Rocket Hideout B2f",
  "201": "Rocket Hideout B3f",
  "202": "Rocket Hideout B4f",
  "203": "Rocket Hideout Elevator",
  "204": "Unused Map Cc",
  "205": "Unused Map Cd",
  "206": "Unused Map Ce",
  "207": "Silph Co 2F",
  "208": "Silph Co 3F",
  "209": "Silph Co 4f",
  "210": "Silph Co 5f",
  "211": "Silph Co 6f",
  "212": "Silph Co 7f",
  "213": "Silph Co 8f",
  "214": "Pokemon Mansion 2F",
  "215": "Pokemon Mansion 3F",
  "216": "Pokemon Mansion B1F",
  "217": "Safari Zone East",
  "218": "Safari Zone North",
  "219": "Safari Zone West",
  "220": "Safari Zone Center",
  "221": "Safari Zone Center Rest House",
  "222": "Safari Zone Secret House",
  "223": "Safari Zone West Rest House",
  "224": "Safari Zone East Rest House",
  "225": "Safari Zone North Rest House",
  "226": "Cerulean Cave 2F",
  "227": "Cerulean Cave B1F",
  "228": "Cerulean Cave 1F",
  "229": "Name Raters House",
  "230": "Cerulean Badge House",
  "231": "Unused Map E7",
  "232": "Rock Tunnel B1F",
  "233": "Silph Co 9f",
  "234": "Silph Co 10f",
  "235": "Silph Co 11f",
  "236": "Silph Co Elevator",
  "237": "Unused Map Ed",
  "238": "Unused Map Ee",
  "239": "Trade Center",
  "240": "Colosseum",
  "241": "Unused Map F1",
  "242": "Unused Map F2",
  "243": "Unused Map F3",
  "244": "Unused Map F4",
  "245": "Loreleis Room",
  "246": "Brunos Room",
  "247": "Agathas Room"
};

let RAW_EXACT_ITEMS = {};
try {
  RAW_EXACT_ITEMS = require('./exact_items.json');
} catch (e) {
  RAW_EXACT_ITEMS = {};
}

let RAW_EXACT_MOVES = {};
try {
  RAW_EXACT_MOVES = require('./exact_moves.json');
} catch (e) {
  RAW_EXACT_MOVES = {};
}

const ITEM_NAMES = new Proxy(RAW_EXACT_ITEMS, {
  get(target, prop) {
    if (prop in target) return target[prop];
    const n = Number(prop);
    if (!isNaN(n) && n > 0) return `Item #${n} (Não Identificado)`;
    return target[prop];
  }
});

const MOVES = new Proxy(RAW_EXACT_MOVES, {
  get(target, prop) {
    if (prop in target) return target[prop];
    const n = Number(prop);
    // ID de golpe desconhecido: NÃO fabricar tipo, poder, precisão ou PP.
    if (!isNaN(n) && n > 0) return undefined;
    return target[prop];
  }
});

const TYPE_CHART_GEN1 = {
  Normal: { Rock: 0.5, Ghost: 0 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2.0, Ice: 2.0, Bug: 2.0, Rock: 0.5, Dragon: 0.5 },
  Water: { Fire: 2.0, Water: 0.5, Grass: 0.5, Ground: 2.0, Rock: 2.0, Dragon: 0.5 },
  Electric: { Water: 2.0, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2.0, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2.0, Grass: 0.5, Poison: 0.5, Ground: 2.0, Flying: 0.5, Bug: 0.5, Rock: 2.0, Dragon: 0.5 },
  Ice: { Water: 0.5, Grass: 2.0, Ice: 0.5, Ground: 2.0, Flying: 2.0, Dragon: 2.0 },
  Fighting: { Normal: 2.0, Ice: 2.0, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2.0, Ghost: 0 },
  Poison: { Grass: 2.0, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Bug: 2.0 },
  Ground: { Fire: 2.0, Electric: 2.0, Grass: 0.5, Poison: 2.0, Flying: 0, Bug: 0.5, Rock: 2.0 },
  Flying: { Electric: 0.5, Grass: 2.0, Fighting: 2.0, Bug: 2.0, Rock: 0.5 },
  Psychic: { Fighting: 2.0, Poison: 2.0, Psychic: 0.5 },
  Bug: { Fire: 0.5, Grass: 2.0, Fighting: 0.5, Poison: 2.0, Flying: 0.5, Psychic: 2.0, Ghost: 0.5 },
  Rock: { Fire: 2.0, Ice: 2.0, Fighting: 0.5, Ground: 0.5, Flying: 2.0, Bug: 2.0 },
  Ghost: { Normal: 0, Psychic: 0, Ghost: 2.0 },
  Dragon: { Dragon: 2.0 }
};

const GEN1_CHAR_MAP = {
  0x7F: ' ',
  0x80: 'A', 0x81: 'B', 0x82: 'C', 0x83: 'D', 0x84: 'E', 0x85: 'F', 0x86: 'G', 0x87: 'H', 0x88: 'I',
  0x89: 'J', 0x8A: 'K', 0x8B: 'L', 0x8C: 'M', 0x8D: 'N', 0x8E: 'O', 0x8F: 'P', 0x90: 'Q', 0x91: 'R',
  0x92: 'S', 0x93: 'T', 0x94: 'U', 0x95: 'V', 0x96: 'W', 0x97: 'X', 0x98: 'Y', 0x99: 'Z',
  0xA0: 'a', 0xA1: 'b', 0xA2: 'c', 0xA3: 'd', 0xA4: 'e', 0xA5: 'f', 0xA6: 'g', 0xA7: 'h', 0xA8: 'i',
  0xA9: 'j', 0xAA: 'k', 0xAB: 'l', 0xAC: 'm', 0xAD: 'n', 0xAE: 'o', 0xAF: 'p', 0xB0: 'q', 0xB1: 'r',
  0xB2: 's', 0xB3: 't', 0xB4: 'u', 0xB5: 'v', 0xB6: 'w', 0xB7: 'x', 0xB8: 'y', 0xB9: 'z',
  0xF6: '0', 0xF7: '1', 0xF8: '2', 0xF9: '3', 0xFA: '4', 0xFB: '5', 0xFC: '6', 0xFD: '7', 0xFE: '8', 0xFF: '9'
};

function decodeGen1Text(hexArr) {
  let str = '';
  for (const h of hexArr) {
    const b = typeof h === 'string' ? parseInt(h, 16) : h;
    if (b === 0x50) break;
    str += GEN1_CHAR_MAP[b] || '';
  }
  return str.trim();
}

function decodeBcdMoney(b1, b2, b3) {
  const h1 = b1.toString(16).padStart(2, '0');
  const h2 = b2.toString(16).padStart(2, '0');
  const h3 = b3.toString(16).padStart(2, '0');
  return parseInt(h1 + h2 + h3, 10);
}

const BADGES_LIST = [
  { name: 'Boulder Badge', leader: 'Brock', city: 'Pewter City', icon: '🪨' },
  { name: 'Cascade Badge', leader: 'Misty', city: 'Cerulean City', icon: '💧' },
  { name: 'Thunder Badge', leader: 'Lt. Surge', city: 'Vermilion City', icon: '⚡' },
  { name: 'Rainbow Badge', leader: 'Erika', city: 'Celadon City', icon: '🌈' },
  { name: 'Soul Badge', leader: 'Koga', city: 'Fuchsia City', icon: '💜' },
  { name: 'Marsh Badge', leader: 'Sabrina', city: 'Saffron City', icon: '👁️' },
  { name: 'Volcano Badge', leader: 'Blaine', city: 'Cinnabar Island', icon: '🌋' },
  { name: 'Earth Badge', leader: 'Giovanni', city: 'Viridian City', icon: '🌍' }
];

function decodeBadges(byte) {
  const b = typeof byte === 'string' ? parseInt(byte, 16) : byte;
  return BADGES_LIST.map((badge, idx) => ({
    ...badge,
    obtained: (b & (1 << idx)) !== 0
  }));
}

function getEffectiveness(attackType, defenderTypes) {
  if (!attackType || !defenderTypes || defenderTypes.length === 0) return 1.0;
  let mult = 1.0;
  for (const defType of defenderTypes) {
    if (TYPE_CHART_GEN1[attackType] && TYPE_CHART_GEN1[attackType][defType] !== undefined) {
      mult *= TYPE_CHART_GEN1[attackType][defType];
    }
  }
  return mult;
}

// Curvas de crescimento oficiais por espécie: pret/pokered/data/pokemon/base_stats/*.asm.
// NÃO usar conjuntos de IDs feitos à mão, que classificavam várias espécies incorretamente.
const CANONICAL_SPECIES = require('./gen1CanonicalSpecies.json').species;

function getGen1ExpForLevel(dex, level) {
  const species = CANONICAL_SPECIES[dex];
  if (!species || !species.sourceVerified || !species.growthRate) return null;
  const n = Math.max(1, Math.min(100, Math.floor(level)));
  if (n === 1) return 0;
  const cube = n * n * n;
  switch (species.growthRate) {
    case 'FAST': return Math.floor(4 * cube / 5);
    case 'MEDIUM_FAST': return cube;
    case 'MEDIUM_SLOW': return Math.max(0, Math.floor(6 * cube / 5 - 15 * n * n + 100 * n - 140));
    case 'SLOW': return Math.floor(5 * cube / 4);
    default: return null;
  }
}

function getGen1LevelFromExp(dex, exp) {
  if (!Number.isInteger(exp) || exp < 0) return null;
  if (getGen1ExpForLevel(dex, 2) === null) return null;
  for (let level = 100; level >= 1; level--) {
    if (exp >= getGen1ExpForLevel(dex, level)) return level;
  }
  return 1;
}

function calculateExpProgress(level, currentExp, dex = 0) {
  const lvl = Math.max(1, Math.min(100, level || 1));
  const exp = Number.isFinite(currentExp) && currentExp >= 0 ? currentExp : null;
  const currentLvlExp = getGen1ExpForLevel(dex, lvl);
  const nextLvlExp = getGen1ExpForLevel(dex, Math.min(100, lvl + 1));
  if (exp === null || currentLvlExp === null || nextLvlExp === null) {
    return { current: exp, next: null, needed: null, percent: null, source: 'CURVA DE EXP NÃO VALIDADA' };
  }
  if (lvl >= 100) return { current: exp, next: nextLvlExp, needed: 0, percent: 100, source: 'pret/pokered' };
  const needed = Math.max(0, nextLvlExp - exp);
  const range = Math.max(1, nextLvlExp - currentLvlExp);
  const percent = Math.max(0, Math.min(100, Math.round(((exp - currentLvlExp) / range) * 100)));
  return { current: exp, next: nextLvlExp, needed, percent, source: 'pret/pokered' };
}

// Cálculo Matemático Exato de Taxa de Captura da Gen 1 (Disassembly Oficial Pokémon Red/Blue)
function calcGen1CatchRate(catchRate, maxHp, currentHp, ballType = 'pokeball', status = 'NONE') {
  if (currentHp <= 0) return 0;
  const B = ballType === 'greatball' ? 200 : ballType === 'ultraball' ? 150 : 255;
  const W = ballType === 'greatball' ? 8 : 12;
  const S = (status === 'SLEEP' || status === 'FREEZE') ? 25 :
            (status === 'POISON' || status === 'PARALYSIS' || status === 'BURN') ? 12 : 0;

  const fStep1 = Math.floor((maxHp * 255) / W);
  const hpDiv = Math.max(1, Math.floor(currentHp / 4));
  const F = Math.min(255, Math.floor(fStep1 / hpDiv));
  const pStep3 = (F + 1) / 256;

  let successCount = 0;
  for (let r1 = 0; r1 <= B; r1++) {
    const r1Prime = r1 - S;
    if (r1Prime < 0) {
      successCount += 1;
    } else if (r1Prime > catchRate) {
      // Falha imediata (a bola quebra/erra)
    } else {
      successCount += pStep3;
    }
  }
  return Math.min(100, Math.max(1, Math.round((successCount / (B + 1)) * 100)));
}

function analyzeBattle(playerMon, enemyMon, isWild, badges = [], inventory = [], party = []) {
  if (!playerMon || !enemyMon) return null;
  const playerTypes = playerMon.types || ['Normal'];
  const enemyTypes = enemyMon.types || ['Normal'];

  // Bónus Ocultos de Insígnias de Ginásio na Gen 1 (+12.5% em combate)
  const hasBoulderBadge = badges.some(b => (b.name && b.name.includes('Boulder')) || b === 'Boulder Badge');
  const hasThunderBadge = badges.some(b => (b.name && b.name.includes('Thunder')) || b === 'Thunder Badge');
  const hasSoulBadge = badges.some(b => (b.name && b.name.includes('Soul')) || b === 'Soul Badge');
  const hasVolcanoBadge = badges.some(b => (b.name && b.name.includes('Volcano')) || b === 'Volcano Badge');

  const badgeAtkMult = hasBoulderBadge ? 1.125 : 1.0;
  const badgeDefMult = hasThunderBadge ? 1.125 : 1.0;
  const badgeSpdMult = hasSoulBadge ? 1.125 : 1.0;
  const badgeSpcMult = hasVolcanoBadge ? 1.125 : 1.0;

  const enemyHp = Math.max(1, enemyMon.hp || 20);
  const enemyMaxHp = Math.max(enemyHp, enemyMon.maxHp || 20);

  // Função auxiliar de cálculo de probabilidade de captura na Gen 1
  const calcBallAtHp = (targetHp, targetStatus = null, ballType = 'pokeball') => {
    const cRate = enemyMon.catchRate || 150;
    const mHp = enemyMaxHp;
    const cHp = Math.max(1, targetHp);
    const statusVal = targetStatus || enemyMon.status || 'NONE';
    return calcGen1CatchRate(cRate, mHp, cHp, ballType, statusVal);
  };

  const moveAnalyses = (playerMon.moves || []).map(move => {
    if (!move || !move.id) return null;
    const moveData = MOVES[move.id];
    if (!moveData) return null; // nunca estimar dano de golpes não identificados
    const effectiveness = getEffectiveness(moveData.type, enemyTypes);
    const hasStab = playerTypes.includes(moveData.type);
    const stabMultiplier = hasStab ? 1.5 : 1.0;

    const isSpecialType = ['Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon'].includes(moveData.type);
    
    // Stats de combate reais com modificadores de estágio da RAM e bónus de insígnia
    const pAtk = ((playerMon.stats && playerMon.stats.attack) ? playerMon.stats.attack : 20) * badgeAtkMult;
    const pSpc = ((playerMon.stats && playerMon.stats.special) ? playerMon.stats.special : 20) * badgeSpcMult;
    const eDef = (enemyMon.stats && enemyMon.stats.defense) ? enemyMon.stats.defense : 20;
    const eSpc = (enemyMon.stats && enemyMon.stats.special) ? enemyMon.stats.special : 20;

    const pModAtk = (playerMon.statMods && playerMon.statMods.attack) ? playerMon.statMods.attack.mult : 1.0;
    const pModSpc = (playerMon.statMods && playerMon.statMods.special) ? playerMon.statMods.special.mult : 1.0;
    const eModDef = (enemyMon.statMods && enemyMon.statMods.defense) ? enemyMon.statMods.defense.mult : 1.0;
    const eModSpc = (enemyMon.statMods && enemyMon.statMods.special) ? enemyMon.statMods.special.mult : 1.0;

    const effectiveA = Math.max(1, Math.floor(isSpecialType ? pSpc * pModSpc : pAtk * pModAtk));
    const effectiveD = Math.max(1, Math.floor(isSpecialType ? eSpc * eModSpc : eDef * eModDef));

    let estDmgMin = 0;
    let estDmgMax = 0;
    if (moveData.power > 0) {
      const level = playerMon.level || 5;
      const baseCalc = Math.floor((Math.floor((2 * level) / 5 + 2) * moveData.power * effectiveA) / effectiveD / 50 + 2);
      const withStab = Math.floor(baseCalc * stabMultiplier);
      const withType = Math.floor(withStab * effectiveness);
      estDmgMax = Math.max(1, withType);
      estDmgMin = Math.max(1, Math.floor(estDmgMax * 0.85));
    }

    const hitsToKo = estDmgMax > 0 ? Math.ceil(enemyHp / estDmgMax) : null;
    const currentPP = move.pp !== undefined ? move.pp : 10;
    const maxPP = moveData.pp || 20;
    const hasPP = currentPP > 0;

    const isSleepMove = ['Sleep Powder', 'Hypnosis', 'Sing', 'Spore'].includes(moveData.name);
    const isParalyzeMove = ['Thunder Wave', 'Stun Spore', 'Glare'].includes(moveData.name);

    // Gestão Inteligente de Golpes & Economia de PP (User request)
    let score = 0;
    let isPpConserving = false;

    if (hasPP) {
      if (estDmgMax > 0) {
        if (hitsToKo === 1) {
          // K.O. IMEDIATO (1 Turno): Prioridade máxima
          // Evita desperdiçar ataques raros/nukes (ex: 5 PP) quando um golpe comum (ex: 25-35 PP) garante o K.O.
          const isGuaranteedOneHitKo = estDmgMin >= enemyHp;
          score = 5000;
          if (isGuaranteedOneHitKo) score += 2000; // 100% garantido sem depender de rolagem

          // Precisão infalível tem prioridade
          score += (moveData.acc / 100) * 1000;

          // Bónus Proporcional de Economia de PP:
          // Quanto mais PP disponível, maior a preferência para poupar recursos!
          const ppRatio = currentPP / maxPP;
          const ppBonus = (currentPP * 40) + (ppRatio * 600);
          score += ppBonus;

          // Se tiver 5 ou menos PP, penaliza para poupar para batalhas importantes/emergências
          if (currentPP <= 5) {
            score -= 800;
          } else if (currentPP >= 15) {
            isPpConserving = true;
          }
        } else if (hitsToKo === 2) {
          // K.O. em 2 turnos
          score = 2000 + (estDmgMax * 12 * effectiveness) * (moveData.acc / 100);
          score += (currentPP * 20); // PP como critério de desempate
        } else {
          // K.O. em 3+ turnos: maior dano com bónus de PP
          score = 100 + (estDmgMax * 15 * effectiveness) * (moveData.acc / 100);
          score += (currentPP * 15);
        }
      } else {
        // Golpes com 0 de dano (Growl, Leer, String Shot, Tail Whip)
        if (isSleepMove || isParalyzeMove) {
          score = 60 * (moveData.acc / 100); // Status incapacitante tem utilidade tática
        } else {
          // Debuffs (Growl, Leer) têm pontuação residual para NUNCA substituírem ataques
          score = 5 * (moveData.acc / 100);
        }
      }
    }

    // Gen 1 Critical Hit chance calculation
    const baseSpeed = (playerMon.baseStats && playerMon.baseStats.spd) || 50;
    const isHighCritMove = ['Slash', 'Razor Leaf', 'Karate Chop', 'Crabhammer'].includes(moveData.name);
    const critChance = isHighCritMove
      ? Math.min(99.6, Math.round((Math.min(255, baseSpeed * 4) / 256) * 1000) / 10)
      : Math.min(99.6, Math.round((Math.min(255, Math.floor(baseSpeed / 2)) / 256) * 1000) / 10);

    // OTIMIZAÇÃO DE CAPTURA POR GOLPE (Em caso de Pokémon Selvagem)
    let catchAdvice = null;
    let killRisk = 0;

    if (isWild) {
      if (isSleepMove) {
        catchAdvice = {
          type: 'optimal',
          label: '💤 GOLPE PERFEITO!',
          desc: 'Adormece o alvo sem causar dano. Aumenta a taxa de captura em +25% de imediato!',
          killRisk: 0
        };
      } else if (isParalyzeMove) {
        catchAdvice = {
          type: 'optimal',
          label: '⚡ PARALISIA SEGURA',
          desc: 'Paralisa o alvo sem dano (+12% de taxa de captura) e reduz a velocidade do adversário.',
          killRisk: 0
        };
      } else if (estDmgMin >= enemyHp) {
        killRisk = 100;
        catchAdvice = {
          type: 'danger',
          label: '🚨 PERIGO DE K.O. (100%)',
          desc: `Causa ${estDmgMin}-${estDmgMax} de dano! Vai matar o ${enemyMon.name} garantidamente. NÃO USES se o quiseres capturar!`,
          killRisk: 100
        };
      } else if (estDmgMax >= enemyHp) {
        const killRange = estDmgMax - enemyHp + 1;
        const totalRange = Math.max(1, estDmgMax - estDmgMin + 1);
        killRisk = Math.min(95, Math.round((killRange / totalRange) * 100));
        catchAdvice = {
          type: 'warning',
          label: `⚠️ RISCO DE K.O. (~${killRisk}%)`,
          desc: `Dano ${estDmgMin}-${estDmgMax} vs ${enemyHp} HP. Se a rolagem de dano for alta, o Pokémon morre!`,
          killRisk
        };
      } else if (estDmgMax > 0) {
        const hpRemainMax = Math.max(1, enemyHp - estDmgMin);
        const hpRemainMin = Math.max(1, enemyHp - estDmgMax);
        const newCatchProb = calcBallAtHp(hpRemainMin);
        catchAdvice = {
          type: 'safe',
          label: '✅ SEGURO P/ ENFRAQUECER',
          desc: `Dano ${estDmgMin}-${estDmgMax}. Deixa o alvo com ~${hpRemainMin}-${hpRemainMax} HP sem matar. Aumenta captura para ~${newCatchProb}%!`,
          killRisk: 0
        };
      } else {
        catchAdvice = {
          type: 'neutral',
          label: '🛡️ GOLPE DE STATUS',
          desc: 'Não causa dano nem risco de K.O.',
          killRisk: 0
        };
      }
    }

    return {
      id: move.id,
      name: moveData.name,
      type: moveData.type,
      power: moveData.power,
      accuracy: moveData.acc,
      pp: currentPP,
      maxPp: maxPP,
      hasPp: hasPP,
      effectiveness,
      hasStab,
      dmgMin: estDmgMin,
      dmgMax: estDmgMax,
      hitsToKo,
      critChance,
      isHighCritMove,
      score,
      isPpConserving,
      catchAdvice,
      killRisk,
      label: !hasPP ? 'SEM PP! 🚫' :
             (hitsToKo === 1 && isPpConserving) ? '⚡ K.O. ECONÓMICO (POUPA PP) 💡' :
             hitsToKo === 1 ? 'K.O. EM 1 TURNO! 💥' :
             effectiveness > 1.5 ? 'SUPER EFETIVO! 💥' :
             effectiveness === 0 ? 'SEM EFEITO! ❌' :
             effectiveness < 1.0 ? 'POUCO EFETIVO 🛡️' : 'DANO NORMAL ⚔️'
    };
  }).filter(Boolean);

  // Ordena por maior pontuação
  moveAnalyses.sort((a, b) => b.score - a.score);

  // Prioridade OBRIGATÓRIA: Escolhe sempre um golpe de DANO com PP se existir!
  // Evita completamente o erro de mandar usar Growl/Leer repetidamente até morrer.
  const damagingWithPp = moveAnalyses.filter(m => m.hasPp && m.dmgMax > 0);
  damagingWithPp.sort((a, b) => b.score - a.score);
  const bestMove = damagingWithPp[0] || moveAnalyses.find(m => m.hasPp) || moveAnalyses[0];

  // Cálculo Exato de Velocidade e Ordem de Turno na Gen 1
  const pSpd = (playerMon.stats && playerMon.stats.speed) ? playerMon.stats.speed : 20;
  const pModSpd = (playerMon.statMods && playerMon.statMods.speed) ? playerMon.statMods.speed.mult : 1.0;
  const effectivePSpd = Math.max(1, Math.floor(pSpd * pModSpd));

  const eSpd = (enemyMon.stats && enemyMon.stats.speed) ? enemyMon.stats.speed : 20;
  const eModSpd = (enemyMon.statMods && enemyMon.statMods.speed) ? enemyMon.statMods.speed.mult : 1.0;
  const effectiveESpd = Math.max(1, Math.floor(eSpd * eModSpd));

  const movesFirst = effectivePSpd >= effectiveESpd;
  const speedDifference = effectivePSpd - effectiveESpd;

  const alerts = [];
  const playerHpPercent = playerMon.maxHp > 0 ? Math.round((playerMon.hp / playerMon.maxHp) * 100) : 0;

  // Alerta de PP
  if (playerMon.moves && playerMon.moves.every(m => m.pp === 0)) {
    alerts.push({ level: 'critical', text: '🚨 SEM PP EM NENHUM GOLPE! O Pokémon vai usar Struggle!' });
  } else if (bestMove && bestMove.pp <= 2 && bestMove.pp > 0) {
    alerts.push({ level: 'warning', text: `⚠️ PP Baixo: ${bestMove.name} tem apenas ${bestMove.pp} PP restante(s)!` });
  }

  // Alerta de HP Crítico & Sugestão de Item da Mochila
  const potionsInInv = inventory.filter(i => i.name && (i.name.includes('Potion') || i.name.includes('Super Potion')));
  if (playerHpPercent <= 25) {
    let potionText = '';
    if (potionsInInv.length > 0) {
      potionText = ` Usa ${potionsInInv[0].name} (tens x${potionsInInv[0].qty} na mochila)!`;
    }
    alerts.push({ level: 'critical', text: `HP Crítico (${playerHpPercent}%)! Risco iminente de desmaio.${potionText}` });
  }

  // Alerta de Status Cures
  if (playerMon.status === 'POISON') {
    const antidotes = inventory.find(i => i.name && i.name.includes('Antidote'));
    if (antidotes) alerts.push({ level: 'warning', text: `☠️ Envenenado! Tens x${antidotes.qty} Antidote na mochila para curar.` });
  } else if (playerMon.status === 'PARALYSIS') {
    const parCure = inventory.find(i => i.name && (i.name.includes('Parlyz') || i.name.includes('Paralyze')));
    if (parCure) alerts.push({ level: 'warning', text: `⚡ Paralisado! Tens x${parCure.qty} Parlyz Heal na mochila.` });
  }

  // Alerta de Ordem de Turno
  if (movesFirst) {
    alerts.push({ level: 'advantage', text: `⚡ Mais Rápido! Atacas primeiro (SPD ${effectivePSpd} vs ${effectiveESpd}).` });
  } else {
    alerts.push({ level: 'warning', text: `🐢 Mais Lento! Inimigo ataca primeiro (SPD ${effectiveESpd} vs ${effectivePSpd}). Cuidado!` });
  }

  // Alerta de K.O. ou Dano Super Efetivo
  if (bestMove && bestMove.hasPp) {
    if (bestMove.hitsToKo === 1) {
      alerts.push({ level: 'advantage', text: `⭐ Vitória em 1 turno com ${bestMove.name}! (Dano ${bestMove.dmgMin}-${bestMove.dmgMax} vs ${enemyHp} HP).` });
    } else if (bestMove.effectiveness >= 2.0) {
      alerts.push({ level: 'advantage', text: `Vantagem de tipo com ${bestMove.name}! Dano x${bestMove.effectiveness} (${bestMove.dmgMin}-${bestMove.dmgMax}).` });
    }
  }

  // 1. CÁLCULO DE AMEAÇA DO INIMIGO E ESTIMATIVA DE DANO RECEBIDO DOS 4 GOLPES
  const enemyAtk = (enemyMon.stats && enemyMon.stats.attack) || 20;
  const enemySpc = (enemyMon.stats && enemyMon.stats.special) || 20;
  const playerDef = Math.max(1, ((playerMon.stats && playerMon.stats.defense) || 20) * badgeDefMult);
  const playerSpc = Math.max(1, ((playerMon.stats && playerMon.stats.special) || 20) * badgeSpcMult);

  const enemyMoveThreats = (enemyMon.moves || []).map(m => {
    const mId = typeof m === 'object' ? m.id : m;
    const mInfo = MOVES[mId];
    if (!mInfo) return null; // ameaça não calculável sem identificação real do golpe
    const isSpecial = ['Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon'].includes(mInfo.type);
    const eff = getEffectiveness(mInfo.type, playerTypes);
    const hasStab = enemyTypes.includes(mInfo.type);
    const stabMult = hasStab ? 1.5 : 1.0;

    let dmgMin = 0, dmgMax = 0;
    if (mInfo.power > 0) {
      const eA = isSpecial ? enemySpc : enemyAtk;
      const pD = isSpecial ? playerSpc : playerDef;
      const base = Math.floor((Math.floor((2 * (enemyMon.level || 5)) / 5 + 2) * mInfo.power * eA) / pD / 50 + 2);
      const withStab = Math.floor(base * stabMult);
      dmgMax = Math.max(1, Math.floor(withStab * eff));
      dmgMin = Math.max(1, Math.floor(dmgMax * 0.85));
    }

    const canKo = dmgMax >= (playerMon.hp || 1);
    const isBide = mInfo.name === 'Bide';
    const isDebuff = ['Screech', 'Leer', 'Growl', 'Tail Whip'].includes(mInfo.name);

    let threatLabel = '';
    if (canKo) threatLabel = `🚨 RISCO DE K.O.! (${dmgMin}-${dmgMax} HP)`;
    else if (isBide) threatLabel = `⚠️ BIDE: Acumula dano e devolve o dobro! Não ataques com dano!`;
    else if (isDebuff) threatLabel = `🛡️ Reduz stats (${mInfo.name})`;
    else if (dmgMax > 0) threatLabel = `Dano: ~${dmgMin}-${dmgMax} HP (${eff}x)`;
    else threatLabel = `Golpe de Status`;

    return {
      name: mInfo.name,
      type: mInfo.type,
      power: mInfo.power,
      accuracy: mInfo.acc || mInfo.accuracy || 100,
      dmgMin,
      dmgMax,
      canKo,
      isBide,
      isDebuff,
      threatLabel
    };
  }).filter(Boolean);

  // Dano máximo que o inimigo consegue causar com qualquer um dos seus golpes
  const maxIncomingDmg = enemyMoveThreats.length > 0 
    ? Math.max(...enemyMoveThreats.map(t => t.dmgMax), 2)
    : Math.max(2, Math.floor((Math.floor((2 * (enemyMon.level || 5)) / 5 + 2) * 40 * enemyAtk) / playerDef / 50 + 2));
  const turnsPlayerSurvives = Math.max(1, Math.ceil((playerMon.hp || 1) / maxIncomingDmg));

  // 2. COMBINAÇÃO ÓTIMA DE ATAQUES (Sobrevivência Máxima + Vitória Mais Rápida)
  let optimalCombo = {
    sequence: [],
    turnsToWin: 1,
    survivalPercent: 95,
    summary: ''
  };

  const sleepMove = moveAnalyses.find(m => m.hasPp && ['Sleep Powder', 'Hypnosis', 'Sing', 'Spore'].includes(m.name));
  const parMove = moveAnalyses.find(m => m.hasPp && ['Thunder Wave', 'Stun Spore', 'Glare'].includes(m.name));

  if (!bestMove || !bestMove.hasPp) {
    optimalCombo = {
      sequence: ['⚠️ Sem golpes com PP! Troca de Pokémon ou usa Struggle.'],
      turnsToWin: 99,
      survivalPercent: 10,
      summary: 'Esgotaste os PPs do Pokémon ativo. Troca de imediato para evitar desmaio.'
    };
  } else if (bestMove.hitsToKo === 1) {
    if (movesFirst) {
      optimalCombo = {
        sequence: [`Turno 1: Usa ${bestMove.name} (K.O. Imediato em 1 golpe!)`],
        turnsToWin: 1,
        survivalPercent: 100,
        summary: `Atacas primeiro com ${bestMove.name}! K.O. imediato no 1º turno sem perigo de sofrer dano (100% sobrevivência).`
      };
    } else {
      const surv = turnsPlayerSurvives > 1 ? 85 : 45;
      optimalCombo = {
        sequence: [`Turno 1: Inimigo ataca primeiro (~${maxIncomingDmg} dano) ➔ Responde com ${bestMove.name} (K.O.)`],
        turnsToWin: 1,
        survivalPercent: surv,
        summary: turnsPlayerSurvives > 1
          ? `O adversário é mais rápido mas o teu HP (${playerMon.hp}) aguenta o golpe. Finaliza logo a seguir com ${bestMove.name}.`
          : `⚠️ PERIGO: O adversário ataca primeiro e pode desmaiar o teu Pokémon! Considera curar ou trocar.`
      };
    }
  } else if (bestMove.hitsToKo === 2) {
    if (sleepMove && !movesFirst && turnsPlayerSurvives <= 2) {
      optimalCombo = {
        sequence: [
          `Turno 1: ${sleepMove.name} (Adormece o alvo com 75% precisão e bloqueia dano inimigo)`,
          `Turno 2-3: ${bestMove.name} contínuo até derrotar`
        ],
        turnsToWin: 3,
        survivalPercent: 90,
        summary: `Adormecer primeiro neutraliza a ameaça do adversário e permite vencer sem perigo de desmaiar.`
      };
    } else if (movesFirst) {
      const surv = turnsPlayerSurvives > 1 ? 95 : 70;
      optimalCombo = {
        sequence: [
          `Turno 1: ${bestMove.name} (Causa ~${bestMove.dmgMin}-${bestMove.dmgMax} de dano)`,
          `Turno 2: ${bestMove.name} (Golpe final de K.O.)`
        ],
        turnsToWin: 2,
        survivalPercent: surv,
        summary: `Vitória em 2 turnos rápidos com ${bestMove.name}. Atacas primeiro em ambos os turnos.`
      };
    } else {
      const surv = turnsPlayerSurvives > 2 ? 80 : 35;
      optimalCombo = {
        sequence: [
          `Turno 1: ${bestMove.name}`,
          `Turno 2: ${bestMove.name} (Finalizador)`
        ],
        turnsToWin: 2,
        survivalPercent: surv,
        summary: turnsPlayerSurvives <= 2
          ? `⚠️ Sobrevivência reduzida (${surv}%): O inimigo ataca duas vezes antes de venceres.`
          : `O teu Pokémon tem ${playerMon.hp} HP e aguenta o combate até finalizar no Turno 2.`
      };
    }
  } else {
    // 3 ou mais turnos
    if (bestMove.dmgMax === 0) {
      optimalCombo = {
        sequence: [`⚠️ ${playerMon.name} não tem nenhum golpe de dano eficaz contra o adversário! Troca imediatamente de Pokémon.`],
        turnsToWin: 99,
        survivalPercent: 15,
        summary: `Não ataques com golpes de status que causam 0 dano. Muda imediatamente para um atacante com vantagem de tipo.`
      };
    } else if (sleepMove) {
      optimalCombo = {
        sequence: [
          `Turno 1: ${sleepMove.name} (Neutraliza o adversário sem sofrer dano)`,
          `Turnos seguintes: ${bestMove.name} até à vitória`
        ],
        turnsToWin: (bestMove.hitsToKo || 3) + 1,
        survivalPercent: 88,
        summary: `Usa ${sleepMove.name} para garantir que o Pokémon sobrevive enquanto desgasta a barra de vida do inimigo.`
      };
    } else {
      optimalCombo = {
        sequence: [`Turnos 1-${bestMove.hitsToKo || 1}: Usa repetidamente ${bestMove.name}`],
        turnsToWin: bestMove.hitsToKo || 1,
        survivalPercent: turnsPlayerSurvives > (bestMove.hitsToKo || 1) ? 85 : 40,
        summary: `Combate de atrito. Vigia o teu HP se o adversário usar golpes fortes.`
      };
    }
  }

  // 3. CONSELHEIRO DINÂMICO DE TROCA (Manter vs Mudar & Prioridade de Treino aos Mais Fracos)
  let switchAdvisor = {
    action: 'KEEP', // 'KEEP', 'SWITCH_FAINTED', 'SWITCH_ADVANTAGE'
    actionTitle: '✅ MANTER EM CAMPO',
    shouldSwitch: false,
    reason: `${playerMon.name} é o combatente ideal nesta fase.`,
    targetMon: null,
    expCandidate: null
  };

  const isPlayerFainted = playerMon.hp === 0;
  const activeIndex = playerMon.partyPos !== undefined ? playerMon.partyPos : 0;
  const livingBench = (party || []).filter((p, idx) => idx !== activeIndex && p.hp > 0);

  // Procura o Pokémon com melhor eficácia no banco
  let bestBenchCandidate = null;
  let highestBenchScore = 0;

  for (const bMon of livingBench) {
    let bestEff = 1.0;
    let bestMoveName = 'Ataque';
    for (const bMove of (bMon.moves || [])) {
      const mInfo = MOVES[bMove.id];
      if (!mInfo) continue;
      const eff = getEffectiveness(mInfo.type, enemyTypes);
      if (eff > bestEff && bMove.pp > 0) {
        bestEff = eff;
        bestMoveName = bMove.name;
      }
    }
    const score = (bestEff * 100) + (bMon.hp / bMon.maxHp * 50);
    if (score > highestBenchScore) {
      highestBenchScore = score;
      bestBenchCandidate = {
        name: bMon.name,
        level: bMon.level,
        hp: bMon.hp,
        maxHp: bMon.maxHp,
        moveName: bestMoveName,
        effectiveness: bestEff,
        types: bMon.types || []
      };
    }
  }

  // Identifica o Pokémon vivo mais fraco da equipa para treino de EXP (Apenas como referência)
  const livingPartySortedByLevel = [...(party || []).filter(p => p.hp > 0)].sort((a, b) => a.level - b.level);
  const weakestLivingMon = livingPartySortedByLevel.length > 0 ? livingPartySortedByLevel[0] : null;
  const isWeakestAlreadyActive = weakestLivingMon && weakestLivingMon.name === playerMon.name;

  if (weakestLivingMon && !isWeakestAlreadyActive) {
    switchAdvisor.expCandidate = {
      name: weakestLivingMon.name,
      level: weakestLivingMon.level,
      hp: weakestLivingMon.hp,
      maxHp: weakestLivingMon.maxHp,
      note: 'Dica de Treino: Se venceres um Pokémon adversário e o jogo der opção de troca livre (modo shift), podes colocar este Pokémon sem perder o turno.'
    };
  }

  // Regras Rigorosas de Troca em Combate:
  if (isPlayerFainted) {
    // 1. Pokémon ativo desmaiou: Troca obrigatória
    switchAdvisor.action = 'SWITCH_FAINTED';
    switchAdvisor.actionTitle = '🚨 POKÉMON DESMAIOU: MUDAR AGORA!';
    switchAdvisor.shouldSwitch = true;
    switchAdvisor.targetMon = bestBenchCandidate || livingBench[0];
    switchAdvisor.reason = `O teu Pokémon ativo não pode continuar. Troca imediatamente para ${switchAdvisor.targetMon ? switchAdvisor.targetMon.name : 'outro Pokémon'} para manter o controlo da batalha.`;
  } else if (enemyHp <= 15) {
    // 2. Adversário quase a morrer: NUNCA TROCAR! Matar imediatamente!
    switchAdvisor.action = 'KEEP';
    switchAdvisor.actionTitle = '⚡ FINALIZAR O ADVERSÁRIO!';
    switchAdvisor.shouldSwitch = false;
    switchAdvisor.targetMon = null;
    switchAdvisor.reason = `O adversário tem apenas ${enemyHp} HP! NÃO TROQUES agora: trocar perde um turno inteiro e levas dano grátis. Usa ${bestMove ? bestMove.name : 'o teu ataque'} para liquidar o adversário já!`;
  } else if (turnsPlayerSurvives <= 1 && !movesFirst && bestBenchCandidate && bestBenchCandidate.hp >= 15 && (!bestMove || bestMove.hitsToKo > 1)) {
    // 3. Risco iminente de morte se não consegues dar K.O. neste turno
    switchAdvisor.action = 'SWITCH_ADVANTAGE';
    switchAdvisor.actionTitle = `⚠️ PERIGO DE MORTE: TROCA PARA ${bestBenchCandidate.name}`;
    switchAdvisor.shouldSwitch = true;
    switchAdvisor.targetMon = bestBenchCandidate;
    switchAdvisor.reason = `${playerMon.name} corre perigo real de K.O. no próximo golpe do inimigo (${playerMon.hp} HP). Trocar para ${bestBenchCandidate.name} salva o teu Pokémon e ataca com ${bestBenchCandidate.moveName}!`;
  } else if (bestBenchCandidate && bestBenchCandidate.effectiveness >= 2.0 && (!bestMove || bestMove.effectiveness < 1.0)) {
    // 4. Vantagem tática extrema no banco
    switchAdvisor.action = 'SWITCH_ADVANTAGE';
    switchAdvisor.actionTitle = `🔄 TROCA TÁTICA RECOMENDADA: ${bestBenchCandidate.name}`;
    switchAdvisor.shouldSwitch = true;
    switchAdvisor.targetMon = bestBenchCandidate;
    switchAdvisor.reason = `${bestBenchCandidate.name} tem o golpe ${bestBenchCandidate.moveName} (${bestBenchCandidate.effectiveness}x Super Efetivo) e vence a batalha muito mais rápido do que ${playerMon.name}.`;
  } else {
    // 5. Manter em campo
    switchAdvisor.action = 'KEEP';
    switchAdvisor.actionTitle = '✅ MANTER EM CAMPO';
    switchAdvisor.shouldSwitch = false;
    switchAdvisor.targetMon = null;
    switchAdvisor.reason = `${playerMon.name} tem a melhor rota de vitória rápida e HP estável (${playerMon.hp}/${playerMon.maxHp}). Não precisas de gastar um turno a trocar.`;
  }

  // Cálculo da Probabilidade Global de Captura (Fórmula Exata Gen 1)
  let catchChance = null;
  if (isWild && enemyMon.hp > 0) {
    const cRate = enemyMon.catchRate || 150;
    const mHp = enemyMaxHp;
    const cHp = enemyHp;
    const curStatus = enemyMon.status || 'NONE';

    catchChance = {
      pokeball: calcGen1CatchRate(cRate, mHp, cHp, 'pokeball', curStatus),
      greatball: calcGen1CatchRate(cRate, mHp, cHp, 'greatball', curStatus),
      ultraball: calcGen1CatchRate(cRate, mHp, cHp, 'ultraball', curStatus),
      withSleep: calcGen1CatchRate(cRate, mHp, cHp, 'pokeball', 'SLEEP'),
      withRedHp: calcGen1CatchRate(cRate, mHp, Math.max(1, Math.floor(mHp * 0.15)), 'pokeball', curStatus)
    };
  }

  return {
    bestMove,
    moves: moveAnalyses,
    enemyThreats: enemyMoveThreats,
    alerts,
    catchChance,
    optimalCombo,
    switchAdvisor,
    benchRecommendation: bestBenchCandidate,
    speed: {
      playerSpd: effectivePSpd,
      enemySpd: effectiveESpd,
      movesFirst,
      diff: speedDifference
    },
    matchupRating: bestMove ? (bestMove.hitsToKo === 1 ? 'VITÓRIA TURNO 1 (100%)' : bestMove.effectiveness >= 2 ? 'MUITO FAVORÁVEL (+80%)' : bestMove.effectiveness < 1 ? 'DESFAVORÁVEL (-50%)' : 'EQUILIBRADO') : 'NEUTRO'
  };
}

module.exports = {
  INTERNAL_TO_POKEMON,
  MAP_NAMES,
  ITEM_NAMES,
  MOVES,
  decodeGen1Text,
  decodeBcdMoney,
  decodeBadges,
  getEffectiveness,
  calculateExpProgress,
  getGen1ExpForLevel,
  getGen1LevelFromExp,
  calcGen1CatchRate,
  analyzeBattle
};
