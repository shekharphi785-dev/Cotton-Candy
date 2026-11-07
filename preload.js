const { contextBridge, ipcRenderer: ipc } = require('electron');
const on = (ch, fn) => ipc.on(ch, (_e, ...a) => fn(...a));
contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipc.invoke('getConfig'),
  saveConfig: c => ipc.invoke('saveConfig', c),
  resize: (w, h) => ipc.send('resize', w, h),
  chat: p => ipc.send('chat', p),
  saveRec: b => ipc.invoke('saveRec', b), transcribe: a => ipc.invoke('transcribe', a), openRecs: () => ipc.send('openRecs'),
  onSttProgress: fn => on('stt-progress', fn), onToggleRec: fn => on('toggle-rec', fn),
  listModels: (n, k) => ipc.invoke('listModels', n, k),
  decide: (id, b) => ipc.send('decide', id, b), onApproval: fn => on('approval', fn),
  quit: () => ipc.send('quit'),
  onChunk: fn => on('chunk', fn), onDone: fn => on('done', fn), onErr: fn => on('err', fn),
  onAgent: fn => on('agent', fn), onCursor: fn => on('cursor', fn), onToggle: fn => on('toggle', fn)
});
