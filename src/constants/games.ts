export interface Game {
  id: string;
  title: string;
  imageUrl: string;
  hints: [string, string, string];
  year: number;
  genre: string;
  developer: string;
  aliases?: string[]; // ✅ ajout
}

const steam = (id: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;

export const GAMES: Game[] = [
  {
    id: '1',
    title: 'Portal 2',
    imageUrl: steam(620),
    hints: ['Jeu de puzzle avec un canon créant des portails', 'Développé par Valve, sorti en 2011', 'La protagoniste Chell affronte l\'IA GLaDOS'],
    year: 2011, genre: 'Puzzle', developer: 'Valve',
  },
  {
    id: '2',
    title: 'The Witcher 3: Wild Hunt',
    imageUrl: steam(292030),
    hints: ['RPG en monde ouvert avec un chasseur de monstres', 'Développé par CD Projekt Red, sorti en 2015', 'Geralt de Riv recherche sa fille adoptive Ciri'],
    year: 2015, genre: 'RPG', developer: 'CD Projekt Red',
  },
  {
    id: '3',
    title: 'Elden Ring',
    imageUrl: steam(1245620),
    hints: ['Action-RPG en monde ouvert dans les Terres Intermédiaires', 'Développé par FromSoftware, sorti en 2022', 'Scénario co-écrit par George R.R. Martin'],
    year: 2022, genre: 'Action-RPG', developer: 'FromSoftware',
  },
  {
    id: '4',
    title: 'Celeste',
    imageUrl: steam(504230),
    hints: ['Platformer pixelisé sur l\'escalade d\'une montagne', 'Aborde la santé mentale et l\'anxiété', 'Madeline escalade le mont Celeste'],
    year: 2018, genre: 'Plateforme', developer: 'Maddy Makes Games',
  },
  {
    id: '5',
    title: 'Hollow Knight',
    imageUrl: steam(367520),
    hints: ['Metroidvania dans un royaume d\'insectes souterrain', 'Développé par Team Cherry, sorti en 2017', 'Un chevalier explore le royaume de Hallownest'],
    year: 2017, genre: 'Metroidvania', developer: 'Team Cherry',
  },
  {
    id: '6',
    title: 'Undertale',
    imageUrl: steam(391540),
    hints: ['RPG terminable sans tuer personne', 'Créé par Toby Fox, sorti en 2015', 'Un enfant tombe dans le monde souterrain des monstres'],
    year: 2015, genre: 'RPG indépendant', developer: 'Toby Fox',
  },
  {
    id: '7',
    title: 'Stardew Valley',
    imageUrl: steam(413150),
    hints: ['Simulation de ferme avec des éléments RPG', 'Développé seul par ConcernedApe, sorti en 2016', 'Vous héritez de la ferme de votre grand-père à Pelican Town'],
    year: 2016, genre: 'Simulation / RPG', developer: 'ConcernedApe',
  },
  {
    id: '8',
    title: 'Hades',
    imageUrl: steam(1145360),
    hints: ['Roguelike où vous jouez le fils du dieu des Enfers', 'Développé par Supergiant Games, sorti en 2020', 'Zagreus tente de fuir les Enfers avec l\'aide des Olympiens'],
    year: 2020, genre: 'Roguelike', developer: 'Supergiant Games',
  },
  {
    id: '9',
    title: 'Disco Elysium',
    imageUrl: steam(632470),
    hints: ['RPG sans combat axé sur les dialogues et enquêtes', 'Un détective amnésique dans une ville post-révolutionnaire', 'Le personnage souffre de la pire gueule de bois de sa vie'],
    year: 2019, genre: 'RPG', developer: 'ZA/UM',
  },
  {
    id: '10',
    title: 'Cyberpunk 2077',
    imageUrl: steam(1091500),
    hints: ['RPG en monde ouvert dans une ville futuriste dystopique', 'Développé par CD Projekt Red, sorti en 2020', 'Vous incarnez V dans la ville de Night City en 2077'],
    year: 2020, genre: 'RPG / Action', developer: 'CD Projekt Red',
  },
  {
    id: '11',
    title: 'Doom Eternal',
    imageUrl: steam(782330),
    hints: ['FPS de tir effréné contre des hordes de démons', 'Suite de Doom (2016), développé par id Software', 'Le Doom Slayer combat l\'invasion démoniaque sur Terre'],
    year: 2020, genre: 'FPS', developer: 'id Software',
  },
  {
    id: '12',
    title: 'Sekiro: Shadows Die Twice',
    imageUrl: steam(814380),
    hints: ['Action-aventure dans le Japon féodal avec mécaniques de parry', 'Développé par FromSoftware, sorti en 2019', 'Le shinobi Le Loup protège son jeune maître'],
    year: 2019, genre: 'Action-aventure', developer: 'FromSoftware',
  },
  {
    id: '13',
    title: 'Resident Evil 2',
    imageUrl: steam(883710),
    hints: ['Survival horror en vue TPS dans une ville infectée', 'Remake du jeu original de 1998, sorti en 2019', 'Leon et Claire fuient Raccoon City'],
    year: 2019, genre: 'Survival Horror', developer: 'Capcom',
  },
  {
    id: '14',
    title: 'Monster Hunter: World',
    imageUrl: steam(582010),
    hints: ['RPG d\'action où vous chassez des monstres géants', 'Développé par Capcom, sorti en 2018', 'Se déroule dans le Nouveau Monde, continent de créatures'],
    year: 2018, genre: 'Action-RPG', developer: 'Capcom',
  },
  {
    id: '15',
    title: 'Dead Cells',
    imageUrl: steam(588650),
    hints: ['Roguelike-Metroidvania avec des cellules mortes comme monnaie', 'Développé par Motion Twin, sorti en 2018', 'Une entité infectieuse contrôle un corps sans tête'],
    year: 2018, genre: 'Roguelike / Metroidvania', developer: 'Motion Twin',
  },
  {
    id: '16',
    title: 'Risk of Rain 2',
    imageUrl: steam(632360),
    hints: ['Roguelike TPS où la difficulté augmente avec le temps', 'Développé par Hopoo Games, sorti en 2019', 'Des survivants combattent sur une planète alien hostile'],
    year: 2019, genre: 'Roguelike / TPS', developer: 'Hopoo Games',
  },
  {
    id: '17',
    title: 'Cuphead',
    imageUrl: steam(268910),
    hints: ['Run-and-gun avec un style cartoon des années 1930', 'Développé par Studio MDHR, sorti en 2017', 'Cuphead et Mugman remboursent leur dette au diable'],
    year: 2017, genre: 'Run and Gun', developer: 'Studio MDHR',
  },
  {
    id: '18',
    title: 'Ori and the Blind Forest',
    imageUrl: steam(261570),
    hints: ['Platformer artistique avec graphismes aquarelle', 'Développé par Moon Studios, sorti en 2015', 'Ori l\'esprit de forêt restaure la forêt de Nibel'],
    year: 2015, genre: 'Plateforme', developer: 'Moon Studios',
  },
  {
    id: '19',
    title: "Don't Starve Together",
    imageUrl: steam(322330),
    hints: ['Jeu de survie multijoueur au style visuel sombre', 'Développé par Klei Entertainment, sorti en 2016', 'Survivez dans un monde étrange sans mourir de faim'],
    year: 2016, genre: 'Survie', developer: 'Klei Entertainment',
  },
  {
    id: '20',
    title: 'Terraria',
    imageUrl: steam(105600),
    hints: ['Sandbox 2D avec construction, exploration et combat', 'Développé par Re-Logic, sorti en 2011', 'Explorez et construisez dans un monde généré aléatoirement'],
    year: 2011, genre: 'Sandbox', developer: 'Re-Logic',
  },
  {
    id: '21',
    title: 'Half-Life 2',
    imageUrl: steam(220),
    hints: ['FPS de science-fiction emblématique dans une ville dystopique', 'Développé par Valve, sorti en 2004', 'Gordon Freeman combat les forces Combine à City 17'],
    year: 2004, genre: 'FPS', developer: 'Valve',
  },
  {
    id: '22',
    title: 'Team Fortress 2',
    imageUrl: steam(440),
    hints: ['FPS multijoueur avec 9 classes de personnages', 'Développé par Valve, sorti en 2007', 'Deux équipes s\'affrontent pour contrôler des objectifs'],
    year: 2007, genre: 'FPS multijoueur', developer: 'Valve',
  },
  {
    id: '23',
    title: 'Fallout 4',
    imageUrl: steam(377160),
    hints: ['RPG post-apocalyptique en monde ouvert à Boston', 'Développé par Bethesda, sorti en 2015', 'Un survivant sort du coffre 210 ans après la Grande Guerre'],
    year: 2015, genre: 'RPG / FPS', developer: 'Bethesda',
  },
  {
    id: '24',
    title: 'Grand Theft Auto V',
    imageUrl: steam(271590),
    hints: ['Jeu d\'action en monde ouvert inspiré de Los Angeles', 'Développé par Rockstar Games, sorti en 2013', 'Michael, Franklin et Trevor braquent des banques à Los Santos'],
    year: 2013, genre: 'Action / Aventure', developer: 'Rockstar Games',
  },
  {
    id: '25',
    title: 'Rocket League',
    imageUrl: steam(252950),
    hints: ['Football avec des voitures propulsées par des fusées', 'Développé par Psyonix, sorti en 2015', 'Marquez des buts avec votre voiture dans des arènes futuristes'],
    year: 2015, genre: 'Sport', developer: 'Psyonix',
  },
  {
    id: '26',
    title: 'Dark Souls III',
    imageUrl: steam(374320),
    hints: ['Action-RPG difficile dans un monde en fin de cycle', 'Développé par FromSoftware, sorti en 2016', 'Les Seigneurs des Cendres et le Bûcher des Cendres'],
    year: 2016, genre: 'Action-RPG', developer: 'FromSoftware',
  },
  {
    id: '27',
    title: 'The Elder Scrolls V: Skyrim',
    imageUrl: steam(489830),
    hints: ['RPG en monde ouvert sous attaque de dragons', 'Développé par Bethesda, sorti en 2011', 'Le Dovahkiin combat Alduin, le dévoreur de monde'],
    year: 2011, genre: 'RPG', developer: 'Bethesda',
  },
  {
    id: '28',
    title: 'Counter-Strike 2',
    imageUrl: steam(730),
    hints: ['FPS tactique multijoueur anti-terroriste', 'Suite de CS:GO développé par Valve, sorti en 2023', 'Posez ou désamorcez des bombes en équipe'],
    year: 2023, genre: 'FPS tactique', developer: 'Valve',
  },
  {
    id: '29',
    title: 'Death Stranding',
    imageUrl: steam(1190460),
    hints: ['Jeu d\'action avec livraison de colis post-apocalyptique', 'Développé par Kojima Productions, sorti en 2019', 'Sam Porter Bridges reconnecte les villes d\'une Amérique dévastée'],
    year: 2019, genre: 'Action', developer: 'Kojima Productions',
  },
  {
    id: '30',
    title: 'Control',
    imageUrl: steam(870780),
    hints: ['TPS action-aventure dans un bâtiment gouvernemental mystérieux', 'Développé par Remedy Entertainment, sorti en 2019', 'Jesse Faden dirige le Bureau fédéral de contrôle'],
    year: 2019, genre: 'Action-aventure', developer: 'Remedy Entertainment',
  },
];

export const GAME_TITLES = GAMES.map((g) => g.title);