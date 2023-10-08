import { formatDuration, compareValues } from "./utils.js";

const colDefs = [
  {
    field: "title",
    headerName: "Title",
    flex: 2,
  },
  {
    field: "length",
    headerName: "Length",
    flex: 0.5,
    cellRenderer: function (params) {
      return formatDuration(params.value);
    },
  },
  {
    field: "artist",
    headerName: "Artist",
    flex: 1,
  },
  {
    field: "album artist",
    headerName: "Album Artist",
    flex: 1,
  },
  {
    field: "album",
    headerName: "Album",
    flex: 1,
  },
  {
    field: "genre",
    headerName: "Genre",
    flex: 1,
  },
  {
    field: "year",
    headerName: "Year",
    flex: 0.5,
  },
  {
    field: "disc",
    headerName: "Disc #",
    hide: true,
    flex: 0.5,
  },
  {
    field: "track",
    headerName: "Track #",
    hide: true,
    flex: 0.5,
  },
  {
    field: "composer",
    headerName: "Composer",
    hide: true,
    flex: 0.5,
  },
  {
    field: "comments",
    headerName: "Comments",
    hide: true,
    flex: 0.5,
  },
];

export default {
  suppressCellFocus: true,
  suppressDragLeaveHidesColumns: true,
  animateRows: true,
  rowSelection: "multiple",
  columnDefs: colDefs,
  defaultColDef: {
    resizable: true,
    sortable: true,
    comparator: (valueA, valueB) => compareValues(valueA, valueB, "asc"),
  },
  overlayLoadingTemplate: '<span id="progressText">Loading...</span>',
  overlayNoRowsTemplate: `Your library is empty, click the upload icon to add some files.`,
  rowData: [],
};
