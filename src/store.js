import { proxy } from "valtio";

const store = proxy({
    addURL: "",
    remCode: "",
    passKey: "",
    searchBar: ""
});

export { store };