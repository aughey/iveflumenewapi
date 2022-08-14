
function RemoteInterface(guiapi) {
    console.log("STarting remote itnerface")
    fetch("/get/types")
        .then(res => res.json())
        .then(json => {
            guiapi.newTypeDescriptions(json);
        })
}

export default RemoteInterface;