import { proxy } from "valtio";

const store = proxy({
    searchBar: "",
    searchResults: []
});

export { store };