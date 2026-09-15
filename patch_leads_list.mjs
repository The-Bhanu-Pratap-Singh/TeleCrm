import fs from 'fs';
let code = fs.readFileSync('src/components/LeadsList.tsx', 'utf-8');

if (!code.includes('WhatsappChatDrawer')) {
  // Import WhatsappChatDrawer
  code = code.replace(/import { Lead, Note, User } from '\.\.\/types';/, "import { Lead, Note, User } from '../types';\nimport WhatsappChatDrawer from './WhatsappChatDrawer';");
  
  // Add state for drawer
  code = code.replace(/const \[isModalOpen, setIsModalOpen\] = useState\(false\);/, "const [isModalOpen, setIsModalOpen] = useState(false);\n  const [isChatOpen, setIsChatOpen] = useState(false);");

  // Add the button to open chat inside the modal footer
  // Search for "Generate WhatsApp Script" button's wrapper
  const targetBtn = `<button
                    type="button"
                    onClick={generateAiScript}
                    disabled={isGeneratingScript}`;
                    
  const openChatBtn = `<button
                    type="button"
                    onClick={() => setIsChatOpen(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Open WhatsApp Chat
                  </button>
                  `;
                  
  code = code.replace(targetBtn, openChatBtn + targetBtn);
  
  // Also add the MessageSquare icon if not imported
  if (!code.includes('MessageSquare') && code.includes('import { ')) {
    code = code.replace(/import { /, 'import { MessageSquare, ');
  }

  // Render the chat drawer at the end of the component
  const drawerTag = `{editingLead && (
        <WhatsappChatDrawer
          lead={editingLead as Lead}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          token={token}
        />
      )}`;
      
  code = code.replace(/<\/div>\s*<\/div>\s*\)\s*}/, drawerTag + '\n    </div>\n  </div>\n  );\n}');
  
  fs.writeFileSync('src/components/LeadsList.tsx', code);
  console.log('Patched LeadsList.tsx');
}
