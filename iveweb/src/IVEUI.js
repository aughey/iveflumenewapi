import { GraphView } from "./GraphView";
import { PanZoomContent } from "./PanZoomContent";

function IVEUI() {
    return (
        <div className="main">
        <div tabIndex={0} >
            <PanZoomContent>
                <GraphView/>
            </PanZoomContent>
        </div>
        </div>
    )
}

export default IVEUI;
