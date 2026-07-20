export type StaticSantaResponseCopy = {
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
  error: {
    title: "SANTA'S WORKSHOP HAD A SMALL MISHAP.",
    supporting:
      'Your request was not submitted. Please try again in a little while.',
  },
} as const satisfies {
  opening: StaticSantaResponseCopy;
  considering: StaticSantaResponseCopy;
  error: StaticSantaResponseCopy;
};
