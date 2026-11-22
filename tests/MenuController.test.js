import test from "node:test";
import assert from "node:assert/strict";
import {
  MenuController,
  MENU_SCREENS,
  MAIN_MENU_ITEMS
} from "../src/ui/MenuController.js";

test("title screen advances to the ordered main menu with keyboard confirmation",()=>{
  const menu=new MenuController();
  assert.equal(menu.screen,MENU_SCREENS.TITLE);
  assert.equal(menu.handleKey("Enter"),true);
  assert.equal(menu.screen,MENU_SCREENS.MAIN);
  assert.deepEqual(MAIN_MENU_ITEMS,["Arcade","Online","Training","Option"]);
  assert.equal(menu.selectedIndex,0);
});

test("main-menu selection wraps and starts Arcade or Training with the chosen mode",()=>{
  const starts=[];
  const menu=new MenuController({onStart:(mode,options)=>starts.push({mode,options})});
  menu.handleKey("Enter");
  menu.handleKey("ArrowUp");
  assert.equal(menu.selectedIndex,3);
  menu.handleKey("ArrowDown");
  assert.equal(menu.selectedIndex,0);
  menu.handleKey("ArrowDown");
  menu.handleKey("ArrowDown");
  menu.handleKey("Enter");
  assert.deepEqual(starts,[{
    mode:"training",
    options:{showHitboxes:false,showInspector:false}
  }]);
  assert.equal(menu.screen,MENU_SCREENS.PLAYING);
});

test("Online explains its unavailable status and returns to the main menu",()=>{
  const menu=new MenuController();
  menu.handleKey("Enter");
  menu.handleKey("ArrowDown");
  menu.handleKey("Enter");
  assert.equal(menu.screen,MENU_SCREENS.ONLINE);
  menu.handleKey("Escape");
  assert.equal(menu.screen,MENU_SCREENS.MAIN);
});

test("Option screen toggles debug overlays and returns to the main menu",()=>{
  const menu=new MenuController();
  menu.handleKey("Enter");
  for(let i=0;i<3;i+=1)menu.handleKey("ArrowDown");
  menu.handleKey("Enter");
  assert.equal(menu.screen,MENU_SCREENS.OPTIONS);
  menu.handleKey("Enter");
  assert.equal(menu.options.showHitboxes,true);
  menu.handleKey("ArrowDown");
  menu.handleKey("Enter");
  assert.equal(menu.options.showInspector,true);
  menu.handleKey("Escape");
  assert.equal(menu.screen,MENU_SCREENS.MAIN);
});

test("direct button selection activates the requested main-menu item",()=>{
  const starts=[];
  const menu=new MenuController({onStart:mode=>starts.push(mode)});
  menu.handleKey("Enter");
  assert.equal(menu.selectItem(0),true);
  assert.deepEqual(starts,["arcade"]);
  assert.equal(menu.screen,MENU_SCREENS.PLAYING);
});

test("invalid menu actions are safely rejected and callbacks are validated",()=>{
  assert.throws(()=>new MenuController({onStart:true}),TypeError);
  const menu=new MenuController();
  assert.equal(menu.selectItem(4),false);
  assert.equal(menu.selectOption(0),false);
});
