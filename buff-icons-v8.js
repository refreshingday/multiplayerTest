export const ICONS=Object.freeze({
 double:'M6 20V11M3 14l3-4 3 4M18 20V5M15 8l3-4 3 4',
 haste:'M3 7h10l-4 5h10M3 17h10M13 3l-3 5M20 12l-4 7',
 power:'M12 2c2 5-2 5 2 8 1-2 3-2 3-4 5 7 4 15-5 16-8-1-10-8-5-12 0 4 3 4 3 1 0-3 3-5 2-9',
 rapid:'M14 2L4 14h7l-1 8 10-12h-7z',
 pierce:'M2 12h20M16 6l6 6-6 6M6 5v14M11 5v14',
 nova:'M12 2l2 6 6-3-3 6 5 2-6 2 3 6-6-3-2 5-2-6-6 2 3-6-5-2 6-2z',
 shield:'M12 2l8 3v7c0 5-8 10-8 10S4 17 4 12V5zM8 12l3 3 5-6',
 'perk-might':'M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3zM12 8v8M8 12h8',
 'perk-swift':'M12 18C5 17 2 12 2 6l10 7L22 6c0 6-3 11-10 12zM12 13v8',
 'perk-focus':'M18 4l2 2M10 2h4M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16M12 8v5l3 2',
 'perk-vitality':'M12 21S2 15 2 8c0-6 8-7 10-1 2-6 10-5 10 1 0 7-10 13-10 13M12 9v7M8.5 12.5h7',
 'perk-armor':'M7 3h10l4 5-4 13H7L3 8zM7 3l5 5 5-5M3 8h18M12 8v13',
 'perk-fortune':'M12 2l2.7 6.3 6.8.6-5.2 4.5 1.6 6.6-5.9-3.5-5.9 3.5 1.6-6.6L2.5 8.9l6.8-.6z',
 'perk-multishot':'M12 21V12M12 12L5 5M12 12l7-7M5 10V4h6M13 4h7v6',
 'perk-pierce':'M12 2v20M7 7l5-5 5 5M5 13h14M5 18h14',
 'perk-blast':'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',
 'perk-leech':'M12 2c-1 5-7 9-7 14a7 7 0 0 0 14 0c0-5-6-9-7-14M12 11v8M8 15h8'
});
export function iconSVG(key){const path=ICONS[key]||ICONS.power;return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+path+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';}
export function paintIcon(ctx,key,color,size=96){
 ctx.clearRect(0,0,size,size);ctx.save();ctx.translate(size/2,size/2);ctx.beginPath();ctx.arc(0,0,size*.44,0,Math.PI*2);ctx.fillStyle='#071925';ctx.fill();ctx.lineWidth=size*.035;ctx.strokeStyle=color;ctx.stroke();ctx.translate(-size*.3,-size*.3);ctx.scale(size*.6/24,size*.6/24);ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke(new Path2D(ICONS[key]||ICONS.power));ctx.restore();
}
