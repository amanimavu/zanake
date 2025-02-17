/* eslint-disable @typescript-eslint/ban-ts-comment */
import { readFileSync, writeFileSync } from 'fs';
import { IDataByEmoji, IDataByGroup, IDataEmojiComponents } from '.';

const VARIATION_16 = String.fromCodePoint(0xfe0f);
const SKIN_TONE_VARIATION_DESC = /\sskin\stone(?:,|$)/;
const orderedEmojiData = readFileSync('./dist/emoji/emoji-order.txt', 'utf-8');
const groupedEmojiData = readFileSync('./dist/emoji/emoji-group.txt', 'utf-8');

const orderedEmoji: string[] = [];
const dataByEmoji: IDataByEmoji = {};
const dataByGroup: IDataByGroup[] = [];
const emojiComponents: IDataEmojiComponents = {};

type EmojiRegexMatchGroups = {
    groups?: { [key: string]: string | undefined; type?: string; emoji?: string; desc?: string; emojiversion?: string };
};
type EmojiRegexMatchTokens = {
    type?: string | 'component' | 'unqualified' | 'fully-qualified' | 'minimally-qualified';
    emoji?: string;
    desc?: string;
    emojiversion?: string;
};
type OrderedEmojiRegexMatchGroups = {
    groups?: { [key: string]: string | undefined; emoji?: string; name?: string; desc?: string; version?: string };
};
type OrderedEmojiRegexMatchTokens = { emoji?: string; name?: string; desc?: string; version?: string };

// 'flag: St. Kitts & Nevis' -> 'flag_st_kitts_nevis'
// 'family: woman, woman, boy, boy' -> 'family_woman_woman_boy_boy'
// 'A button (blood type)' -> 'a_button'
// 'Cocos (Keeling) Islands' -> 'cocos_islands'
// 'keycap *' -> 'keycap_asterisk'
//
// Returns machine readable emoji short code
const SLUGIFY_REPLACEMENT = { '*': 'asterisk', '#': 'number sign' };

type SlugifyReplacementKey = keyof typeof SLUGIFY_REPLACEMENT;
type SlugifyReplacementVal = typeof SLUGIFY_REPLACEMENT[SlugifyReplacementKey];

function slugify(str: string): string {
    for (const key in SLUGIFY_REPLACEMENT) {
        str = str.replace(key, SLUGIFY_REPLACEMENT[key as SlugifyReplacementKey] as SlugifyReplacementVal);
    }

    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\(.+\)/g, '')
        .trim()
        .replace(/[\W|_]+/g, '_')
        .toLowerCase();
}

//
// We only want fully-qualified emoji in the output data

// # group: Smileys & Emotion
//          |1--------------|
//
const GROUP_REGEX = /^#\sgroup:\s(?<name>.+)/;

// 1F646 200D 2640 FE0F                       ; fully-qualified     # 🙆‍♀️ E4.0 woman gesturing OK
//                                              |1------------|      |2--||3-| |4---------------|
// 1F469 200D 1F469 200D 1F467 200D 1F467     ; fully-qualified     # 👩‍👩‍👧‍👧 E2.0 family: woman, woman, girl, girl
//                                              |1------------|      |2-| |3| |4-----------------------------|
//
const EMOJI_REGEX = /^[^#]+;\s(?<type>[\w-]+)\s+#\s(?<emoji>\S+)\sE(?<emojiversion>\d+\.\d)\s(?<desc>.+)/;
let currentGroup: any = null;

groupedEmojiData.split('\n').forEach((line) => {
    const groupMatch = line.match(GROUP_REGEX);
    if (groupMatch && groupMatch.groups !== undefined) {
        currentGroup = groupMatch.groups['name'];
    } else {
        const emojiMatch = line.match(EMOJI_REGEX);
        if (emojiMatch && emojiMatch.groups !== undefined) {
            const { groups }: EmojiRegexMatchGroups = emojiMatch;
            const { type, emoji, desc, emojiversion }: EmojiRegexMatchTokens = groups;

            if (type === 'fully-qualified') {
                if (line.match(SKIN_TONE_VARIATION_DESC)) return;

                if (emoji) {
                    dataByEmoji[emoji] = {
                        // @ts-ignore
                        name: null,
                        // @ts-ignore
                        slug: null,
                        group: currentGroup,
                        // @ts-ignore
                        unicode_version: null,
                        // @ts-ignore
                        skin_tone_support: null,
                        // @ts-ignore
                        emoji_version: emojiversion,
                    };
                }
            } else if (type === 'component') {
                if (emoji) emojiComponents[slugify(desc || '')] = emoji;
            }
        }
    }
});

// U+1F44B ; 6.0 # 👋 waving hand
//          |1--| |2-|3----------|
//
// U+1F442 U+1F3FB ; 8.0 # 👂🏻 ear: light skin tone
//                  |1--| |2-|3--||4--------------|
//
// U+1F469 U+200D U+1F467 U+200D U+1F467 ; 6.0 # 👩‍👧‍👧 family: woman, girl, girl
//                                        |1--| |2-|3-----||4----------------|
//
const ORDERED_EMOJI_REGEX = /.+\s;\s(?<version>[0-9.]+)\s#\s(?<emoji>\S+)\s(?<name>[^:]+)(?::\s)?(?<desc>.+)?/;

let currentEmoji: any = null;

orderedEmojiData.split('\n').forEach((line) => {
    if (line.length === 0) return;
    const match = line.match(ORDERED_EMOJI_REGEX);
    if (!match || match.groups === undefined) return;

    const { groups }: OrderedEmojiRegexMatchGroups = match;
    const { version, emoji, name, desc }: OrderedEmojiRegexMatchTokens = groups;

    const isSkinToneVariation = desc && !!desc.match(SKIN_TONE_VARIATION_DESC);
    const fullName = desc && !isSkinToneVariation ? [name, desc].join(' ') : name;
    if (isSkinToneVariation) {
        dataByEmoji[currentEmoji].skin_tone_support = true;
        dataByEmoji[currentEmoji].skin_tone_support_unicode_version = version;
    } else {
        // Workaround for ordered data missing VARIATION_16 (smiling_face)
        if (emoji) {
            const emojiWithOptionalVariation16 = dataByEmoji[emoji] ? emoji : emoji + VARIATION_16;
            const emojiEntry = dataByEmoji[emojiWithOptionalVariation16];
            if (!emojiEntry) {
                if (Object.values(emojiComponents).includes(emoji)) return;
                throw `${emoji} entry from emoji-order.txt match not found in emoji-group.txt`;
            }
            currentEmoji = emojiWithOptionalVariation16;
            orderedEmoji.push(currentEmoji);
            dataByEmoji[currentEmoji].name = fullName || '';
            dataByEmoji[currentEmoji].skin_tone_support = false;
            dataByEmoji[currentEmoji].slug = slugify(fullName || '');
            dataByEmoji[currentEmoji].unicode_version = version || '';
        }
    }
});

for (const emoji of orderedEmoji) {
    const { group, skin_tone_support, skin_tone_support_unicode_version, name, slug, emoji_version, unicode_version } =
        dataByEmoji[emoji];
    let groupIndex = dataByGroup.findIndex((element) => element.name === group);
    if (groupIndex === -1) {
        dataByGroup.push({ name: group, slug: slugify(group), emojis: [] });
        groupIndex = dataByGroup.findIndex((element) => element.name === group);
    }

    // @ts-ignore
    dataByGroup[groupIndex].emojis.push({
        name,
        slug,
        emoji,
        emoji_version,
        unicode_version,
        skin_tone_support,
        skin_tone_support_unicode_version,
    });
}

writeFileSync('./dist/emoji/data-by-emoji.json', JSON.stringify(dataByEmoji, null, 4));

writeFileSync('./dist/emoji/data-by-group.json', JSON.stringify(dataByGroup, null, 4));

writeFileSync('./dist/emoji/data-ordered-emoji.json', JSON.stringify(orderedEmoji, null, 4));

writeFileSync('./dist/emoji/data-emoji-components.json', JSON.stringify(emojiComponents, null, 4));
