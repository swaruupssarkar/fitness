const fs = require('fs');
const code = fs.readFileSync('js/social.js', 'utf8');

// Mock DOM
global.window = {};
global.document = {
  getElementById: () => ({ innerHTML: '', querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {} }),
  querySelectorAll: () => [],
  createElement: () => ({ classList: { add: () => {}, remove: () => {} } })
};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.location = { hash: '#rooms', origin: '', pathname: '', search: '' };
global.navigator = {};
global.Auth = { getDb: () => ({ collection: () => ({ doc: () => ({ set: () => Promise.resolve(), collection: () => ({ add: () => Promise.resolve(), orderBy: () => ({ limit: () => ({ onSnapshot: () => {} }) }) }), onSnapshot: () => {} }) }), limit: () => ({ onSnapshot: () => {} }) }), getUser: () => ({ uid: '123', displayName: 'Test', photoURL: '' }) };
global.Plans = { getActivePlan: () => null };
global.App = { requireAuth: () => true, navigate: () => {}, toast: () => {} };
global.esc = (str) => String(str);

try {
  eval(code + '\nglobal.Social = Social;');
  global.Social.renderRooms();
  console.log("No error thrown during renderRooms!");
} catch(e) {
  console.error("ERROR:", e);
}
