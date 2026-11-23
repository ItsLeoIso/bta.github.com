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
  assert.equal(menu.screen,MENU_SCREENS.INTRO);
  assert.equal(menu.finishIntro(),true);
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
  assert.equal(menu.screen,MENU_SCREENS.CHARACTER_SELECT);
  assert.equal(menu.getViewModel().selectedCharacter.id,"striker");
  assert.equal(menu.confirmCharacter(),true);
  assert.deepEqual(starts,[{
    mode:"training",
    options:{
      showHitboxes:false,
      showInspector:false,
      playerCharacterId:"striker",
      opponentCharacterId:"cpu-rival"
    }
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
  assert.equal(menu.screen,MENU_SCREENS.CHARACTER_SELECT);
  assert.equal(menu.confirmCharacter(),true);
  assert.deepEqual(starts,["arcade"]);
  assert.equal(menu.screen,MENU_SCREENS.PLAYING);
});

test("invalid menu actions are safely rejected and callbacks are validated",()=>{
  assert.throws(()=>new MenuController({onStart:true}),TypeError);
  const menu=new MenuController();
  assert.equal(menu.selectItem(4),false);
  assert.equal(menu.selectOption(0),false);
});


test("pause menu resumes, restarts the current mode, and exits back to Arcade selection",()=>{
  const starts=[];
  const menu=new MenuController({onStart:mode=>starts.push(mode)});
  menu.handleKey("Enter");
  menu.selectItem(2);
  menu.confirmCharacter();
  assert.equal(menu.screen,MENU_SCREENS.PLAYING);
  assert.equal(menu.mode,"training");

  assert.equal(menu.pause(),true);
  assert.equal(menu.screen,MENU_SCREENS.PAUSE);
  assert.deepEqual(menu.getViewModel().pauseItems,[
    "Resume","Reset Positions","Restart Mode","Exit to Menu"
  ]);
  menu.handleKey("Escape");
  assert.equal(menu.screen,MENU_SCREENS.PLAYING);

  menu.pause();
  menu.selectPauseItem(2);
  assert.deepEqual(starts,["training","training"]);
  assert.equal(menu.screen,MENU_SCREENS.PLAYING);

  menu.pause();
  menu.selectPauseItem(3);
  assert.equal(menu.screen,MENU_SCREENS.MAIN);
  assert.equal(menu.selectedIndex,0);
});

test("Training pause menu resets positions through its callback and resumes",()=>{
  let resetCount=0;
  const menu=new MenuController({onResetTraining:()=>{resetCount+=1;}});
  menu.handleKey("Enter");
  menu.selectItem(2);
  menu.confirmCharacter();
  menu.pause();
  assert.equal(menu.selectPauseItem(1),true);
  assert.equal(resetCount,1);
  assert.equal(menu.screen,MENU_SCREENS.PLAYING);
});

test("Arcade pause menu has no Training-only reset action",()=>{
  const menu=new MenuController();
  menu.handleKey("Enter");
  menu.selectItem(0);
  menu.confirmCharacter();
  menu.pause();
  assert.deepEqual(menu.getViewModel().pauseItems,[
    "Resume","Restart Mode","Exit to Menu"
  ]);
});


test("character select cycles the roster, updates the opposing matchup, and starts with selected ids",()=>{
  const starts=[];
  const menu=new MenuController({onStart:(mode,options)=>starts.push({mode,options})});
  menu.handleKey("Enter");
  menu.selectItem(0);
  assert.equal(menu.screen,MENU_SCREENS.CHARACTER_SELECT);
  assert.equal(menu.getViewModel().selectedCharacter.id,"striker");
  assert.equal(menu.getViewModel().opponentCharacter.id,"cpu-rival");

  menu.handleKey("ArrowRight");
  assert.equal(menu.getViewModel().selectedCharacter.id,"cpu-rival");
  assert.equal(menu.getViewModel().opponentCharacter.id,"striker");
  menu.handleKey("ArrowRight");
  assert.equal(menu.getViewModel().selectedCharacter.id,"striker");
  menu.handleKey("ArrowLeft");
  assert.equal(menu.getViewModel().selectedCharacter.id,"cpu-rival");
  menu.handleKey("Enter");

  assert.equal(menu.screen,MENU_SCREENS.PLAYING);
  assert.deepEqual(starts,[{
    mode:"arcade",
    options:{
      showHitboxes:false,
      showInspector:false,
      playerCharacterId:"cpu-rival",
      opponentCharacterId:"striker"
    }
  }]);
});

test("character select can be cancelled without starting a match",()=>{
  const starts=[];
  const menu=new MenuController({onStart:mode=>starts.push(mode)});
  menu.handleKey("Enter");
  menu.selectItem(2);
  assert.equal(menu.screen,MENU_SCREENS.CHARACTER_SELECT);
  menu.handleKey("Escape");
  assert.equal(menu.screen,MENU_SCREENS.MAIN);
  assert.deepEqual(starts,[]);
});


test("any ordinary key starts the intro, which only reveals the main menu when finished",()=>{
  const menu=new MenuController();
  assert.equal(menu.handleKey("x"),true);
  assert.equal(menu.screen,MENU_SCREENS.INTRO);
  assert.equal(menu.handleKey("ArrowDown"),true);
  assert.equal(menu.screen,MENU_SCREENS.INTRO);
  assert.equal(menu.finishIntro(),true);
  assert.equal(menu.screen,MENU_SCREENS.MAIN);
  assert.equal(menu.finishIntro(),false);
});

test("title intro can also be started by pointer and cannot be skipped mid-animation",()=>{
  const menu=new MenuController();
  assert.equal(menu.startIntro(),true);
  assert.equal(menu.screen,MENU_SCREENS.INTRO);
  assert.equal(menu.startIntro(),false);
  assert.equal(menu.finishIntro(),true);
});
