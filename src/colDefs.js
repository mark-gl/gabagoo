export default [
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
