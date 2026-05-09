// =====================================================
// WORDS-DEFAULT.JS - Starter vocabulary sets
// =====================================================

const DefaultWords = {
  load() {
    // Only load if no words exist yet
    if (DataManager.data.words.length > 0) return;

    const categories = [
      {
        name: 'Rodina',
        nameEn: 'Family',
        icon: '👨‍👩‍👧',
        words: [
          { czech: 'máma', english: 'mother' },
          { czech: 'táta', english: 'father' },
          { czech: 'sestra', english: 'sister' },
          { czech: 'bratr', english: 'brother' },
          { czech: 'babička', english: 'grandmother' },
          { czech: 'dědeček', english: 'grandfather' },
          { czech: 'rodina', english: 'family' },
          { czech: 'dcera', english: 'daughter' },
          { czech: 'syn', english: 'son' },
          { czech: 'dítě', english: 'child' },
          { czech: 'teta', english: 'aunt' },
          { czech: 'strýc', english: 'uncle' }
        ]
      },
      {
        name: 'Barvy',
        nameEn: 'Colors',
        icon: '🎨',
        words: [
          { czech: 'červená', english: 'red' },
          { czech: 'modrá', english: 'blue' },
          { czech: 'zelená', english: 'green' },
          { czech: 'žlutá', english: 'yellow' },
          { czech: 'bílá', english: 'white' },
          { czech: 'černá', english: 'black' },
          { czech: 'růžová', english: 'pink' },
          { czech: 'oranžová', english: 'orange' },
          { czech: 'fialová', english: 'purple' },
          { czech: 'hnědá', english: 'brown' },
          { czech: 'šedá', english: 'grey' }
        ]
      },
      {
        name: 'Zvířata',
        nameEn: 'Animals',
        icon: '🐾',
        words: [
          { czech: 'pes', english: 'dog' },
          { czech: 'kočka', english: 'cat' },
          { czech: 'pták', english: 'bird' },
          { czech: 'ryba', english: 'fish' },
          { czech: 'kůň', english: 'horse' },
          { czech: 'kráva', english: 'cow' },
          { czech: 'prase', english: 'pig' },
          { czech: 'ovce', english: 'sheep' },
          { czech: 'králík', english: 'rabbit' },
          { czech: 'myš', english: 'mouse' },
          { czech: 'had', english: 'snake' },
          { czech: 'žába', english: 'frog' }
        ]
      },
      {
        name: 'Jídlo',
        nameEn: 'Food',
        icon: '🍕',
        words: [
          { czech: 'jablko', english: 'apple' },
          { czech: 'chleba', english: 'bread' },
          { czech: 'mléko', english: 'milk' },
          { czech: 'voda', english: 'water' },
          { czech: 'sýr', english: 'cheese' },
          { czech: 'maso', english: 'meat' },
          { czech: 'rýže', english: 'rice' },
          { czech: 'dort', english: 'cake' },
          { czech: 'zmrzlina', english: 'ice cream' },
          { czech: 'čokoláda', english: 'chocolate' }
        ]
      },
      {
        name: 'Čísla',
        nameEn: 'Numbers',
        icon: '🔢',
        words: [
          { czech: 'jedna', english: 'one' },
          { czech: 'dva', english: 'two' },
          { czech: 'tři', english: 'three' },
          { czech: 'čtyři', english: 'four' },
          { czech: 'pět', english: 'five' },
          { czech: 'šest', english: 'six' },
          { czech: 'sedm', english: 'seven' },
          { czech: 'osm', english: 'eight' },
          { czech: 'devět', english: 'nine' },
          { czech: 'deset', english: 'ten' }
        ]
      }
    ];

    for (const catData of categories) {
      const category = {
        id: DataManager.generateId('cat'),
        name: catData.name,
        nameEn: catData.nameEn,
        icon: catData.icon,
        createdAt: new Date().toISOString()
      };

      DataManager.addWords(category, catData.words);
    }
  }
};
