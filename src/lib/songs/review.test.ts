import { describe, expect, it } from "vitest";
import { alreadyIn, notSongReason } from "./review";

const song = (title: string) => ({ title, slides: [{ text: "Way maker, miracle worker\nPromise keeper, light in the darkness" }] });

describe("notSongReason", () => {
  it("flags dated service sets", () => {
    for (const t of ["Praise 12.07.2026", "Praise-6-9-2026", "Choir Ministration-19-7-2026", "Praise 16:03:2025", "Praise- 12.10.25"]) {
      expect(notSongReason(song(t))).toMatch(/service set/);
    }
  });

  it("leaves songs with numbers in their title alone", () => {
    for (const t of ["10,000 Reasons", "Psalm 23", "Way Maker", "Hosanna 2"]) expect(notSongReason(song(t))).toBeNull();
  });
});

describe("alreadyIn", () => {
  const library = [
    { title: "Way Maker", body: "Way maker miracle worker promise keeper\nLight in the darkness my God that is who you are" },
    { title: "Amazing Grace", body: "Amazing grace how sweet the sound\nThat saved a wretch like me" },
  ];
  it("finds a song already in the library, even with its lines split differently", () => {
    const again = { title: "Waymaker", slides: [{ text: "Way maker, miracle worker" }, { text: "Promise keeper, light in the darkness\nMy God, that is who you are" }] };
    expect(alreadyIn([again], library)).toEqual(["Way Maker"]);
  });
  it("leaves a new song alone", () => {
    const fresh = { title: "Goodness of God", slides: [{ text: "I love you Lord, oh your mercy never fails me" }] };
    expect(alreadyIn([fresh], library)).toEqual([null]);
  });
});
