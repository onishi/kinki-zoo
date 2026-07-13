export interface AnimalTaxonomy {
  id: string;
  canonicalName: string;
  className: string;
  orderName: string;
  familyName: string;
  genusName: string;
  speciesName: string;
  notes?: string;
}

interface TaxonomyRule extends AnimalTaxonomy {
  patterns: string[];
}

function normalizeForRule(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[ぁ-ん]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) + 0x60)
    )
    .trim();
}

function speciesRule(
  id: string,
  canonicalName: string,
  className: string,
  orderName: string,
  familyName: string,
  genusName: string,
  speciesName: string,
  patterns: string[],
  notes?: string
): TaxonomyRule {
  return {
    id,
    canonicalName,
    className,
    orderName,
    familyName,
    genusName,
    speciesName,
    patterns,
    notes,
  };
}

const SPECIES_RULES: TaxonomyRule[] = [
  speciesRule("snow-leopard", "ユキヒョウ", "哺乳類", "食肉目", "ネコ科", "ヒョウ属", "ユキヒョウ", ["ユキヒョウ"]),
  speciesRule("leopard", "ヒョウ", "哺乳類", "食肉目", "ネコ科", "ヒョウ属", "ヒョウ", ["ヒョウ", "アムールヒョウ"]),
  speciesRule("lion", "ライオン", "哺乳類", "食肉目", "ネコ科", "ヒョウ属", "ライオン", ["ライオン"]),
  speciesRule("tiger", "トラ", "哺乳類", "食肉目", "ネコ科", "ヒョウ属", "トラ", ["トラ", "タイガー"]),
  speciesRule("jaguar", "ジャガー", "哺乳類", "食肉目", "ネコ科", "ヒョウ属", "ジャガー", ["ジャガー"]),
  speciesRule("serval", "サーバル", "哺乳類", "食肉目", "ネコ科", "サーバル属", "サーバル", ["サーバル"]),
  speciesRule("caracal", "カラカル", "哺乳類", "食肉目", "ネコ科", "カラカル属", "カラカル", ["カラカル"]),
  speciesRule("manul", "マヌルネコ", "哺乳類", "食肉目", "ネコ科", "マヌルネコ属", "マヌルネコ", ["マヌルネコ"]),
  speciesRule("bobcat", "ボブキャット", "哺乳類", "食肉目", "ネコ科", "オオヤマネコ属", "ボブキャット", ["ボブキャット"]),
  speciesRule("eurasian-lynx", "オオヤマネコ", "哺乳類", "食肉目", "ネコ科", "オオヤマネコ属", "オオヤマネコ", ["オオヤマネコ"]),
  speciesRule("wolf", "オオカミ", "哺乳類", "食肉目", "イヌ科", "イヌ属", "オオカミ", ["オオカミ"]),
  speciesRule("raccoon-dog", "タヌキ", "哺乳類", "食肉目", "イヌ科", "タヌキ属", "タヌキ", ["タヌキ"]),
  speciesRule("bush-dog", "ヤブイヌ", "哺乳類", "食肉目", "イヌ科", "ヤブイヌ属", "ヤブイヌ", ["ヤブイヌ"]),
  speciesRule("red-panda", "レッサーパンダ", "哺乳類", "食肉目", "レッサーパンダ科", "レッサーパンダ属", "レッサーパンダ", ["レッサーパンダ"]),
  speciesRule("giant-panda", "ジャイアントパンダ", "哺乳類", "食肉目", "クマ科", "ジャイアントパンダ属", "ジャイアントパンダ", ["ジャイアントパンダ"]),
  speciesRule("california-sea-lion", "カリフォルニアアシカ", "哺乳類", "食肉目", "アシカ科", "アシカ属", "カリフォルニアアシカ", ["カリフォルニアアシカ"]),
  speciesRule("spotted-seal", "ゴマフアザラシ", "哺乳類", "食肉目", "アザラシ科", "ゴマフアザラシ属", "ゴマフアザラシ", ["ゴマフアザラシ"]),
  speciesRule("small-clawed-otter", "コツメカワウソ", "哺乳類", "食肉目", "イタチ科", "ツメナシカワウソ属", "コツメカワウソ", ["コツメカワウソ"]),
  speciesRule("meerkat", "ミーアキャット", "哺乳類", "食肉目", "マングース科", "スリカータ属", "ミーアキャット", ["ミーアキャット"]),
  speciesRule("dwarf-mongoose", "コビトマングース", "哺乳類", "食肉目", "マングース科", "コビトマングース属", "コビトマングース", ["コビトマングース"]),
  speciesRule("binturong", "ビントロング", "哺乳類", "食肉目", "ジャコウネコ科", "ビントロング属", "ビントロング", ["ビントロング"]),
  speciesRule("kinkajou", "キンカジュー", "哺乳類", "食肉目", "アライグマ科", "キンカジュー属", "キンカジュー", ["キンカジュー"]),
  speciesRule("ring-tailed-coati", "アカハナグマ", "哺乳類", "食肉目", "アライグマ科", "ハナグマ属", "アカハナグマ", ["アカハナグマ"]),
  speciesRule("asian-elephant", "アジアゾウ", "哺乳類", "長鼻目", "ゾウ科", "アジアゾウ属", "アジアゾウ", ["アジアゾウ"]),
  speciesRule("african-elephant", "アフリカゾウ", "哺乳類", "長鼻目", "ゾウ科", "アフリカゾウ属", "アフリカゾウ", ["アフリカゾウ"]),
  speciesRule("giraffe", "キリン", "哺乳類", "鯨偶蹄目", "キリン科", "キリン属", "キリン", ["キリン"]),
  speciesRule("hippopotamus", "カバ", "哺乳類", "鯨偶蹄目", "カバ科", "カバ属", "カバ", ["カバ"]),
  speciesRule("black-rhinoceros", "クロサイ", "哺乳類", "奇蹄目", "サイ科", "クロサイ属", "クロサイ", ["クロサイ"]),
  speciesRule("white-rhinoceros", "シロサイ", "哺乳類", "奇蹄目", "サイ科", "シロサイ属", "シロサイ", ["シロサイ"]),
  speciesRule("grevys-zebra", "グレビーシマウマ", "哺乳類", "奇蹄目", "ウマ科", "ウマ属", "グレビーシマウマ", ["グレビーシマウマ"]),
  speciesRule("plains-zebra", "サバンナシマウマ", "哺乳類", "奇蹄目", "ウマ科", "ウマ属", "サバンナシマウマ", ["グラントシマウマ", "チャップマンシマウマ"]),
  speciesRule("donkey", "ロバ", "哺乳類", "奇蹄目", "ウマ科", "ウマ属", "ロバ", ["ロバ"]),
  speciesRule("american-tapir", "アメリカバク", "哺乳類", "奇蹄目", "バク科", "バク属", "アメリカバク", ["アメリカバク"]),
  speciesRule("malayan-tapir", "マレーバク", "哺乳類", "奇蹄目", "バク科", "バク属", "マレーバク", ["マレーバク"]),
  speciesRule("alpaca", "アルパカ", "哺乳類", "鯨偶蹄目", "ラクダ科", "ビクーニャ属", "アルパカ", ["アルパカ"]),
  speciesRule("llama", "ラマ", "哺乳類", "鯨偶蹄目", "ラクダ科", "ラマ属", "ラマ", ["ラマ"]),
  speciesRule("bactrian-camel", "フタコブラクダ", "哺乳類", "鯨偶蹄目", "ラクダ科", "ラクダ属", "フタコブラクダ", ["フタコブラクダ"]),
  speciesRule("dromedary", "ヒトコブラクダ", "哺乳類", "鯨偶蹄目", "ラクダ科", "ラクダ属", "ヒトコブラクダ", ["ヒトコブラクダ"]),
  speciesRule("japanese-deer", "ニホンジカ", "哺乳類", "鯨偶蹄目", "シカ科", "シカ属", "ニホンジカ", ["=シカ", "ニホンジカ", "ホンシュウジカ"]),
  speciesRule("koala", "コアラ", "哺乳類", "双前歯目", "コアラ科", "コアラ属", "コアラ", ["コアラ"]),
  speciesRule("wombat", "ウォンバット", "哺乳類", "双前歯目", "ウォンバット科", "ウォンバット属", "ウォンバット", ["ウォンバット"]),
  speciesRule("red-kangaroo", "アカカンガルー", "哺乳類", "双前歯目", "カンガルー科", "アカカンガルー属", "アカカンガルー", ["アカカンガルー"]),
  speciesRule("red-necked-wallaby", "ベネットアカクビワラビー", "哺乳類", "双前歯目", "カンガルー科", "ヤブワラビー属", "ベネットアカクビワラビー", ["ベネットアカクビ"]),
  speciesRule("capybara", "カピバラ", "哺乳類", "齧歯目", "テンジクネズミ科", "カピバラ属", "カピバラ", ["カピバラ"]),
  speciesRule("domestic-guinea-pig", "モルモット", "哺乳類", "齧歯目", "テンジクネズミ科", "テンジクネズミ属", "モルモット", ["モルモット", "テンジクネズミ"]),
  speciesRule("mara", "マーラ", "哺乳類", "齧歯目", "テンジクネズミ科", "マーラ属", "マーラ", ["マーラ"]),
  speciesRule("domestic-rabbit", "アナウサギ", "哺乳類", "ウサギ目", "ウサギ科", "アナウサギ属", "アナウサギ", ["ドワーフ・ホト", "ドワーフホト", "ネザーランド・ドワーフ", "ネザーランドドワーフ"]),
  speciesRule("japanese-squirrel", "ニホンリス", "哺乳類", "齧歯目", "リス科", "リス属", "ニホンリス", ["ニホンリス"]),
  speciesRule("chipmunk", "シマリス", "哺乳類", "齧歯目", "リス科", "シマリス属", "シマリス", ["シマリス"]),
  speciesRule("black-tailed-prairie-dog", "オグロプレーリードッグ", "哺乳類", "齧歯目", "リス科", "プレーリードッグ属", "オグロプレーリードッグ", ["オグロプレーリードッグ"]),
  speciesRule("crested-porcupine", "タテガミヤマアラシ", "哺乳類", "齧歯目", "ヤマアラシ科", "ヤマアラシ属", "タテガミヤマアラシ", ["タテガミヤマアラシ"]),
  speciesRule("giant-anteater", "オオアリクイ", "哺乳類", "有毛目", "アリクイ科", "オオアリクイ属", "オオアリクイ", ["オオアリクイ"]),
  speciesRule("cape-hyrax", "ケープハイラックス", "哺乳類", "ハイラックス目", "ハイラックス科", "ハイラックス属", "ケープハイラックス", ["ケープハイラックス"]),
  speciesRule("bottlenose-dolphin", "バンドウイルカ", "哺乳類", "鯨偶蹄目", "マイルカ科", "ハンドウイルカ属", "バンドウイルカ", ["バンドウイルカ"]),
  speciesRule("pacific-white-sided-dolphin", "カマイルカ", "哺乳類", "鯨偶蹄目", "マイルカ科", "カマイルカ属", "カマイルカ", ["カマイルカ"]),
  speciesRule("chimpanzee", "チンパンジー", "哺乳類", "霊長目", "ヒト科", "チンパンジー属", "チンパンジー", ["チンパンジー"]),
  speciesRule("western-gorilla", "ニシゴリラ", "哺乳類", "霊長目", "ヒト科", "ゴリラ属", "ニシゴリラ", ["ニシゴリラ"]),
  speciesRule("bornean-orangutan", "ボルネオオランウータン", "哺乳類", "霊長目", "ヒト科", "オランウータン属", "ボルネオオランウータン", ["ボルネオオランウータン"]),
  speciesRule("ring-tailed-lemur", "ワオキツネザル", "哺乳類", "霊長目", "キツネザル科", "ワオキツネザル属", "ワオキツネザル", ["ワオキツネザル"]),
  speciesRule("ruffed-lemur", "クロシロエリマキキツネザル", "哺乳類", "霊長目", "キツネザル科", "エリマキキツネザル属", "クロシロエリマキキツネザル", ["クロシロエリマキキツネザル"]),
  speciesRule("common-marmoset", "コモンマーモセット", "哺乳類", "霊長目", "オマキザル科", "コモンマーモセット属", "コモンマーモセット", ["コモンマーモセット"]),
  speciesRule("mandrill", "マンドリル", "哺乳類", "霊長目", "オナガザル科", "マンドリル属", "マンドリル", ["マンドリル"]),
  speciesRule("hamadryas-baboon", "マントヒヒ", "哺乳類", "霊長目", "オナガザル科", "ヒヒ属", "マントヒヒ", ["マントヒヒ"]),
  speciesRule("japanese-cormorant", "カワウ", "鳥類", "カツオドリ目", "ウ科", "カワウ属", "カワウ", ["カワウ"]),
  speciesRule("peregrine-falcon", "ハヤブサ", "鳥類", "ハヤブサ目", "ハヤブサ科", "ハヤブサ属", "ハヤブサ", ["ハヤブサ"]),
  speciesRule("ostrich", "ダチョウ", "鳥類", "ダチョウ目", "ダチョウ科", "ダチョウ属", "ダチョウ", ["ダチョウ"]),
  speciesRule("emu", "エミュー", "鳥類", "ヒクイドリ目", "ヒクイドリ科", "エミュー属", "エミュー", ["エミュー"]),
  speciesRule("humboldt-penguin", "フンボルトペンギン", "鳥類", "ペンギン目", "ペンギン科", "フンボルトペンギン属", "フンボルトペンギン", ["フンボルトペンギン"]),
  speciesRule("king-penguin", "オウサマペンギン", "鳥類", "ペンギン目", "ペンギン科", "オウサマペンギン属", "オウサマペンギン", ["オウサマペンギン"]),
  speciesRule("emperor-penguin", "コウテイペンギン", "鳥類", "ペンギン目", "ペンギン科", "コウテイペンギン属", "コウテイペンギン", ["コウテイペンギン"]),
  speciesRule("adele-penguin", "アデリーペンギン", "鳥類", "ペンギン目", "ペンギン科", "アデリーペンギン属", "アデリーペンギン", ["アデリーペンギン"]),
  speciesRule("little-penguin", "コガタペンギン", "鳥類", "ペンギン目", "ペンギン科", "コガタペンギン属", "コガタペンギン", ["コガタペンギン"]),
  speciesRule("lesser-flamingo", "コフラミンゴ", "鳥類", "フラミンゴ目", "フラミンゴ科", "コフラミンゴ属", "コフラミンゴ", ["コフラミンゴ"]),
  speciesRule("chilean-flamingo", "チリーフラミンゴ", "鳥類", "フラミンゴ目", "フラミンゴ科", "フラミンゴ属", "チリーフラミンゴ", ["チリーフラミンゴ"]),
  speciesRule("roseate-spoonbill", "ショウジョウトキ", "鳥類", "ペリカン目", "トキ科", "ヘラサギ属", "ショウジョウトキ", ["ショウジョウトキ"]),
  speciesRule("grey-heron", "アオサギ", "鳥類", "ペリカン目", "サギ科", "アオサギ属", "アオサギ", ["アオサギ"]),
  speciesRule("little-egret", "コサギ", "鳥類", "ペリカン目", "サギ科", "コサギ属", "コサギ", ["コサギ"]),
  speciesRule("black-crowned-night-heron", "ゴイサギ", "鳥類", "ペリカン目", "サギ科", "ゴイサギ属", "ゴイサギ", ["ゴイサギ"]),
  speciesRule("oriental-honey-buzzard", "ハチクマ", "鳥類", "タカ目", "タカ科", "ハチクマ属", "ハチクマ", ["ハチクマ"]),
  speciesRule("steller-sea-eagle", "オジロワシ", "鳥類", "タカ目", "タカ科", "オジロワシ属", "オジロワシ", ["オジロワシ"]),
  speciesRule("bald-eagle", "ハクトウワシ", "鳥類", "タカ目", "タカ科", "ウミワシ属", "ハクトウワシ", ["ハクトウワシ"]),
  speciesRule("barn-owl", "メンフクロウ", "鳥類", "フクロウ目", "メンフクロウ科", "メンフクロウ属", "メンフクロウ", ["メンフクロウ"]),
  speciesRule("snowy-owl", "シロフクロウ", "鳥類", "フクロウ目", "フクロウ科", "ワシミミズク属", "シロフクロウ", ["シロフクロウ"]),
  speciesRule("burrowing-owl", "アナホリフクロウ", "鳥類", "フクロウ目", "フクロウ科", "アナホリフクロウ属", "アナホリフクロウ", ["アナホリフクロウ"]),
  speciesRule("great-horned-owl", "アメリカワシミミズク", "鳥類", "フクロウ目", "フクロウ科", "ワシミミズク属", "アメリカワシミミズク", ["アメリカワシミミズク"]),
  speciesRule("great-hornbill", "ギンガオサイチョウ", "鳥類", "サイチョウ目", "サイチョウ科", "サイチョウ属", "ギンガオサイチョウ", ["ギンガオサイチョウ"]),
  speciesRule("southern-ground-hornbill", "ミナミジサイチョウ", "鳥類", "サイチョウ目", "ジサイチョウ科", "ジサイチョウ属", "ミナミジサイチョウ", ["ミナミジサイチョウ"]),
  speciesRule("black-tailed-gull", "ユリカモメ", "鳥類", "チドリ目", "カモメ科", "カモメ属", "ユリカモメ", ["ユリカモメ"]),
  speciesRule("chinese-alligator", "ヨウスコウワニ", "爬虫類", "ワニ目", "アリゲーター科", "アリゲーター属", "ヨウスコウワニ", ["ヨウスコウワニ"]),
  speciesRule("american-alligator", "ミシシッピーワニ", "爬虫類", "ワニ目", "アリゲーター科", "アリゲーター属", "ミシシッピーワニ", ["ミシシッピーワニ"]),
  speciesRule("nile-monitor", "ナイルオオトカゲ", "爬虫類", "有鱗目", "オオトカゲ科", "オオトカゲ属", "ナイルオオトカゲ", ["ナイルオオトカゲ"]),
  speciesRule("green-iguana", "グリーンイグアナ", "爬虫類", "有鱗目", "イグアナ科", "イグアナ属", "グリーンイグアナ", ["グリーンイグアナ"]),
  speciesRule("panther-chameleon", "パンサーカメレオン", "爬虫類", "有鱗目", "カメレオン科", "フサエカメレオン属", "パンサーカメレオン", ["パンサーカメレオン"]),
  speciesRule("radiated-tortoise", "ホウシャガメ", "爬虫類", "カメ目", "リクガメ科", "マダガスカルリクガメ属", "ホウシャガメ", ["ホウシャガメ"]),
  speciesRule("aldabra-giant-tortoise", "アルダブラゾウガメ", "爬虫類", "カメ目", "リクガメ科", "アルダブラゾウガメ属", "アルダブラゾウガメ", ["アルダブラゾウガメ"]),
  speciesRule("japanese-giant-salamander", "オオサンショウウオ", "両生類", "有尾目", "オオサンショウウオ科", "オオサンショウウオ属", "オオサンショウウオ", ["オオサンショウウオ"]),
  speciesRule("japanese-fire-belly-newt", "アカハライモリ", "両生類", "有尾目", "イモリ科", "イモリ属", "アカハライモリ", ["アカハライモリ"]),
  speciesRule("nile-tilapia", "ナイルティラピア", "魚類", "カワスズメ目", "カワスズメ科", "オレオクロミス属", "ナイルティラピア", ["ナイルティラピア"]),
  speciesRule("striped-bitterling", "イチモンジタナゴ", "魚類", "コイ目", "コイ科", "タナゴ属", "イチモンジタナゴ", ["イチモンジタナゴ"]),
];

export function findAnimalTaxonomy(displayName: string): AnimalTaxonomy | null {
  const normalized = normalizeForRule(displayName);
  const rule = SPECIES_RULES.find((candidate) =>
    candidate.patterns.some((pattern) =>
      pattern.startsWith("=")
        ? normalized === pattern.slice(1)
        : normalized === pattern || normalized.endsWith(pattern)
    )
  );

  if (!rule) return null;

  const { patterns: _patterns, ...taxonomy } = rule;
  return taxonomy;
}
