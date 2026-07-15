export type SantaResponseTemplate = {
  title: string;
  supporting?: string;
};

export const santaResponses = {
  opening: {
    title: 'HELLO THERE! WHAT WOULD YOU LIKE FROM SANTA?',
    supporting:
      'TELL SANTA WHAT YOU WANT. HE MAY APPROVE IT WITH GREAT CEREMONY!',
  },
  considering: {
    title: 'SANTA IS CONSIDERING...',
    supporting: 'HOLD TIGHT WHILE SANTA GIVES YOUR REQUEST A PROPER PONDER.',
  },
  approved: [
    {
      title: 'SANTA COMMANDS IT!',
      supporting: 'VERY WELL, {name}.',
    },
    {
      title: 'SANTA COMMANDS IT!',
      supporting: 'SO IT SHALL BE.',
    },
    {
      title: 'SANTA COMMANDS IT!',
      supporting: 'AN EXCELLENT IDEA.',
    },
    {
      title: 'SANTA COMMANDS IT!',
      supporting: 'SANTA HAS CONSIDERED IT.',
    },
  ],
  coal: [
    {
      title: 'SANTA COMMANDS COAL!',
      supporting: 'SANTA HAS DECIDED THAT TODAY IS A COAL DAY.',
    },
    {
      title: 'COAL!',
      supporting: 'A PERFECTLY REASONABLE REQUEST. DENIED ANYWAY.',
    },
    {
      title: 'COAL!',
      supporting: 'SANTA IS FEELING CAPRICIOUS.',
    },
    {
      title: 'SANTA COMMANDS COAL!',
      supporting: 'NOT THIS TIME, {name}.',
    },
    {
      title: 'COAL!',
      supporting: 'SANTA HAS SPOKEN. YOU GET COAL.',
    },
  ],
  blocked: [
    {
      title: 'THAT IS UNACCEPTABLE. ASK FOR SOMETHING ELSE OR RECEIVE COAL!',
      supporting:
        'Santa will give you another chance to choose something kinder.',
    },
    {
      title: 'SANTA WILL NOT COMMAND THAT. TRY SOMETHING KINDER.',
      supporting:
        'Santa is giving you one more chance to choose something better.',
    },
  ],
  error: {
    title: "SANTA'S WORKSHOP HAD A SMALL MISHAP.",
    supporting: 'Please try again.',
  },
} as const satisfies {
  opening: SantaResponseTemplate;
  considering: SantaResponseTemplate;
  approved: readonly SantaResponseTemplate[];
  coal: readonly SantaResponseTemplate[];
  blocked: readonly SantaResponseTemplate[];
  error: SantaResponseTemplate;
};
