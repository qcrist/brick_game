import {createRoot} from "react-dom/client";
import {RootFrame} from "./components/RootFrame";

import React from "react";

function start() {
    const content_root = document.getElementById("content_root");
    if (!content_root) {
        throw new Error("missing root?")
    }
    const root = createRoot(content_root);
    root.render(<RootFrame/>)
}


start();


