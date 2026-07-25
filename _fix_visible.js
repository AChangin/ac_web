var fs=require('fs');
var html=fs.readFileSync('C:/Users/28077/Desktop/web_test/project.html','utf8');

var start = html.indexOf('    _contrastFrame: 0,');
var m = html.match(/\n\s+destroy:\s*function/);
if (!m || start < 0) { console.log('NOT FOUND'); process.exit(1); }
var beforeDestroy = html.lastIndexOf('},', html.indexOf(m[0]));

var lines = [
'    _contrastFrame: 0,',
'    updateContrast: function() {',
'      var self = this;',
'      if (!self.config.autoContrast) { self.container.classList.add("pb-light"); return; }',
'      self._contrastFrame = (self._contrastFrame || 0) + 1;',
'      if (self._contrastFrame % 15 !== 0) return;',
'      var dbg = document.getElementById("pb-debug");',
'      if (!dbg) {',
'        dbg = document.createElement("div"); dbg.id = "pb-debug";',
'        dbg.style.cssText = "position:fixed;top:0;left:0;z-index:99999;pointer-events:none;font:9px monospace;color:#0f0";',
'        document.body.appendChild(dbg);',
'      }',
'      var infoLines = [];',
'      var lightVotes = 0, totalVotes = 0;',
'      var dotsHTML = "";',
'      for (var i = 0; i < 5; i++) {',
'        var sx = window.innerWidth * (0.1 + i * 0.2);',
'        var sy = window.innerHeight * 0.5;',
'        var canvasX = scrollX + sx;',
'        // Find elements covering this point, must be vertically in viewport too',
'        var matches = [];',
'        for (var ei = 0; ei < self._flatElements.length; ei++) {',
'          var fe = self._flatElements[ei];',
'          // Check horizontal overlap',
'          if (canvasX < fe.worldX || canvasX > fe.worldX + fe.w) continue;',
'          // Check vertical: element must be within viewport vertically',
'          var ey = resolvePX(fe.el.y || fe.el.top || 0);',
'          var eh = fe.h;',
'          if (ey > window.innerHeight || ey + eh < 0) continue; // off-screen vertically',
'          // Element covers this point',
'          matches.push(fe.el);',
'        }',
'        // Find best color from topmost match first',
'        var foundColor = "", foundSource = "";',
'        for (var mi = matches.length - 1; mi >= 0; mi--) {',
'          var ed = matches[mi];',
'          if (ed.background && ed.background !== "transparent" && ed.background !== "rgba(0, 0, 0, 0)") {',
'            foundColor = ed.background; foundSource = ed.type + ".bg"; break;',
'          }',
'          if (ed.color && ed.color !== "rgb(0, 0, 0)" && ed.color !== "#000" && ed.color !== "#000000") {',
'            foundColor = ed.color; foundSource = ed.type + ".color";',
'          }',
'        }',
'        if (!foundColor) { foundColor = self._narrative.pageBackground || "#000000"; foundSource = "pageBG"; }',
'        // Parse and vote',
'        var rgb = {r:0,g:0,b:0}, isLight = false;',
'        if (foundColor.charAt(0) === "#") {',
'          var h = foundColor.substring(1);',
'          if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];',
'          if (h.length >= 6) { rgb.r = parseInt(h.substring(0,2),16); rgb.g = parseInt(h.substring(2,4),16); rgb.b = parseInt(h.substring(4,6),16); }',
'        } else if (foundColor.indexOf("rgb") >= 0) {',
'          var nums2 = foundColor.substring(foundColor.indexOf("(")+1, foundColor.indexOf(")")).split(",");',
'          if (nums2.length >= 3) { rgb.r = parseInt(nums2[0]); rgb.g = parseInt(nums2[1]); rgb.b = parseInt(nums2[2]); }',
'        }',
'        var lum = (0.299*rgb.r + 0.587*rgb.g + 0.114*rgb.b) / 255;',
'        totalVotes++;',
'        if (lum > 0.5) { lightVotes++; isLight = true; }',
'        infoLines.push("pt"+i+" x="+Math.round(canvasX)+" m="+matches.length+" -> "+(isLight?"L":"D"));',
'        // Visual dot at sample position',
'        dotsHTML += "<span style=\"position:fixed;left:"+sx+"px;top:"+sy+"px;width:10px;height:10px;border-radius:50%;background:"+foundColor+";border:2px solid "+(isLight?"#000":"#fff")+";transform:translate(-50%,-50%)"+(i===2?";width:14px;height:14px":"")+"\"></span>";',
'      }',
'      var isLight = totalVotes > 0 && lightVotes >= totalVotes * 0.5;',
'      infoLines.push("=" + lightVotes + "/" + totalVotes + " -> " + (isLight ? "LIGHT" : "DARK"));',
'      dbg.innerHTML = "<div style=\"background:rgba(0,0,0,0.8);padding:4px 6px;border-radius:3px;white-space:nowrap\">"+infoLines.join(" ")+"</div>" + dotsHTML;',
'      dbg.style.background = "none";',
'      self.container.classList.toggle("pb-light", isLight);',
'    },',
'',
'    '
];

var newBlock = lines.join('\n');
html = html.substring(0, start) + newBlock + html.substring(beforeDestroy + 2);
fs.writeFileSync('C:/Users/28077/Desktop/web_test/project.html', html);
console.log('OK - visible dots + vertical bounds check');

var m2 = html.match(/<script>([\s\S]*?)<\/script>/);
fs.writeFileSync('C:/Users/28077/Desktop/web_test/_check_vis.js', m2[1]);
