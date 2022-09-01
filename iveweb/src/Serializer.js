// little function to serialize all calls
export function SerializeWrap(fn) {
    const pending = [];
    var waiting = false;

    const checkRun = async () => {
        if (waiting) {
            return;
        }
        waiting = true;
        while (pending.length > 0) {
            const torun = pending.shift();
            await torun();
        }
        waiting = false;
    };

    function serialize() {
        // use arguments
        var args = arguments;
        return new Promise((resolve, reject) => {
            pending.push(async () => {
                try {
                    resolve(await fn.apply(null,args));
                } catch (e) {
                    reject(e);
                }
            });
            checkRun();
        });
    };
    return serialize;
}
