export const manifest = {
  screens: {
    scr_vbqv7s: { name: "1 · Resting Knowledge Centre", route: "/", state: {"trail":[]}, position: {"x":160,"y":220} },
    scr_jy67bx: { name: "2 · Risk inspector (compact)", route: "/", state: {"trail":["r-build"]}, position: {"x":160,"y":2200} },
    scr_kqokj8: { name: "3 · Risk · More details", route: "/", state: {"trail":["r-build"],"expanded":true}, position: {"x":1560,"y":2200} },
    scr_x7h7yh: { name: "4 · Person · Elena Rostova", route: "/", state: {"trail":["r-build","p-elena"]}, position: {"x":160,"y":4180} },
    scr_bdtfml: { name: "5 · Connected · Payments pipeline", route: "/", state: {"trail":["r-build","p-elena","a-payments"]}, position: {"x":160,"y":6160} },
    scr_ufi4b4: { name: "6 · Connected · Decision", route: "/", state: {"trail":["r-build","p-elena","a-payments","dec-gates"]}, position: {"x":1560,"y":6160} },
    scr_ulhrzw: { name: "7 · To Do inspector", route: "/", state: {"trail":["t-cabpack"]}, position: {"x":2960,"y":2200} },
    scr_gj80wq: { name: "8 · Milestone · CAB approval", route: "/", state: {"trail":["d-cab"]}, position: {"x":4360,"y":2200} },
    scr_gbhpiq: { name: "9 · Needs you · Marcus Webb", route: "/", state: {"trail":["p-marcus"]}, position: {"x":160,"y":8140} },
  },
  sections: {
    sec_gajjbg: { name: "Home", x: 0, y: 0, width: 1520, height: 1180 },
    sec_dixyvl: { name: "Risk & Approval Workflow", x: 0, y: 1980, width: 5720, height: 1180 },
    sec_to60fk: { name: "Person Details", x: 0, y: 3960, width: 1520, height: 1180 },
    sec_kccp2s: { name: "Connected Payments", x: 0, y: 5940, width: 2920, height: 1180 },
    sec_9lbb6s: { name: "Alerts & Notifications", x: 0, y: 7920, width: 1520, height: 1180 },
  },
  layers: [
    { kind: "section", id: "sec_gajjbg", children: [
      { kind: "screen", id: "scr_vbqv7s" },
    ] },
    { kind: "section", id: "sec_dixyvl", children: [
      { kind: "screen", id: "scr_jy67bx" },
      { kind: "screen", id: "scr_kqokj8" },
      { kind: "screen", id: "scr_ulhrzw" },
      { kind: "screen", id: "scr_gj80wq" },
    ] },
    { kind: "section", id: "sec_to60fk", children: [
      { kind: "screen", id: "scr_x7h7yh" },
    ] },
    { kind: "section", id: "sec_kccp2s", children: [
      { kind: "screen", id: "scr_bdtfml" },
      { kind: "screen", id: "scr_ufi4b4" },
    ] },
    { kind: "section", id: "sec_9lbb6s", children: [
      { kind: "screen", id: "scr_gbhpiq" },
    ] },
  ],
}
