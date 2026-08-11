"use client";

/**
 * Persistent best-practice prompt shown inside Capture now that Coach
 * no longer sits beside it.
 */
export function CaptureBestPractice() {
  return (
    <aside className="capture-best-practice" aria-label="Capture best practice">
      <p className="capture-best-practice-title">Best practice</p>
      <p className="capture-best-practice-lead">
        Talk to Lume the way you&apos;d brief a sharp colleague. Direct language
        and useful detail beat polished status updates.
      </p>
      <ul className="capture-best-practice-list">
        <li>
          Name the project when it could be ambiguous —{" "}
          <em>“ATLAS: complete the CAB task.”</em>
        </li>
        <li>
          Include people, dates, risks and decisions in the same breath —{" "}
          <em>“HORIZON: change launch to 24 September.”</em>
        </li>
        <li>
          Capture the odd rules you normally keep in your head —{" "}
          <em>“Remember that CAB needs the pack 24h before the board.”</em>
        </li>
        <li>
          Say what still needs doing or who you&apos;re waiting on —{" "}
          <em>“Create a To Do to call the vendor.”</em>
        </li>
      </ul>
    </aside>
  );
}
