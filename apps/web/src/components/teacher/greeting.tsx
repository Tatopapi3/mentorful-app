"use client";

import { useSyncExternalStore } from "react";

// The hour and the date only mean something in the teacher's own time zone, which the server doesn't know. The server
// snapshot is neutral ("Hello", "Today"); the browser's real values replace it once hydrated, so nobody is told good
// morning at 4pm and there is no hydration mismatch.
const noSubscribe = () => () => {};

export function Greeting({ first }: { first: string }) {
  const word = useSyncExternalStore(
    noSubscribe,
    () => {
      const h = new Date().getHours();
      return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    },
    () => "Hello",
  );
  return (
    <>
      {word}, <em>{first}</em>.
    </>
  );
}

export function Today() {
  const text = useSyncExternalStore(
    noSubscribe,
    () => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
    () => "Today",
  );
  return <>{text}</>;
}
