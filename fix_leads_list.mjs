import fs from 'fs';
let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

// The injected code is:
const injected = `{editingLead && (
        <WhatsappChatDrawer
          lead={editingLead as Lead}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          token={token}
        />
      )}
    </div>
  </div>
  );
}`;

// Revert that specific occurrence (it was replaced where "</div></div>)}" was)
// Wait, the original was `          </div>\n        </div>\n      )}\n`
// Let's just find the `WhatsappChatDrawer` and replace that block with the original div closures.

code = code.replace(/{editingLead && \([\s\S]*?<WhatsappChatDrawer[\s\S]*?\/>\s*\)}\s*<\/div>\s*<\/div>\s*\);\s*}/, '</div>\n        </div>\n      )}');

// Now append the WhatsappChatDrawer right before the final `</div>\n  );\n}`
// To find the final return statement closure safely:
const finalMatch = code.match(/<\/div>\s*\);\s*}/);
if (finalMatch) {
  code = code.substring(0, finalMatch.index) + 
  `\n      {editingLead && (
        <WhatsappChatDrawer
          lead={editingLead as Lead}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          token={token}
        />
      )}\n` + code.substring(finalMatch.index);
} else {
  console.log("Could not find final closure");
}

fs.writeFileSync('src/components/LeadsList.tsx', code);
console.log('Fixed LeadsList.tsx');
