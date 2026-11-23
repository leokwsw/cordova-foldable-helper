const exec = require('cordova/exec');
const { createAPI } = require('com.leokwsw.foldable.layout');

module.exports = createAPI((id, listener, onError) => new Promise((resolve, reject) => {
    let active = true;
    let started = false;
    let removal;
    const handle = {
        remove() {
            active = false;
            removal ??= new Promise((done, fail) => {
                exec(done, fail, 'FoldableLayout', 'unwatch', [id]);
            });
            return removal;
        }
    };
    exec(state => {
        if (!active) return;
        started = true;
        resolve(handle);
        listener(state);
    }, error => {
        active = false;
        if (started) onError?.(error);
        else reject(error);
    }, 'FoldableLayout', 'watch', [id]);
}));
