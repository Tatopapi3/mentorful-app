"use client";

import { useEffect, useState } from "react";

/**
 * "Good morning" only means something in the teacher's own time zone, which the server doesn't know. It renders a
 * neutral "Hello" first and settles on the hour once it is in the browser, so nobody is told good morning at 4pm.
 */
export function Greeting({ first }: { first: string }) {
  const [word, setWord] = useState("Hello");
  useEffect(() => {
    const h = new Date().getHours();
    setWord(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return (
    <>
      {word}, <em>{first}</em>.
    </>
  );
}

export function Today() {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()));
  }, []);
  return <span suppressHydrationWarning>{text || "Today"}</span>;
}
