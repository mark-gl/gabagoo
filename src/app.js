document.addEventListener("DOMContentLoaded", (event) => {
  const musicMetadata = require("music-metadata-browser");
  const { Grid } = require("ag-grid-community");

  let totalAudioFiles = 0;
  let currentTrackIndex = null;
  let tracks = [];
  let audio;
  let libraryDirectory;
  let db;

  // Initialise the metadata database
  let openRequest = indexedDB.open("audioMetadataDB", 1);
  openRequest.onupgradeneeded = function (event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains("metadata")) {
      db.createObjectStore("metadata", { keyPath: "name" });
    }
  };
  openRequest.onsuccess = function (event) {
    db = event.target.result;
  };
  openRequest.onerror = function (event) {
    console.log("IndexedDB error: " + event.target.errorCode);
  };

  const gridOptions = {
    enableColResize: true,
    rowSelection: "multiple",
    // animateRows: true,
    getRowStyle: function (params) {
      if (params.node.rowIndex === currentTrackIndex) {
        return { fontWeight: "bold" };
      } else {
        return null;
      }
    },
    columnDefs: [
      { field: "title", resizable: true, sortable: true },
      { field: "artist", resizable: true, sortable: true },
      { field: "album artist", resizable: true, sortable: true },
      { field: "album", resizable: true, sortable: true },
      { field: "length", resizable: true, sortable: true },
      { field: "genre", resizable: true, sortable: true },
      { field: "year", resizable: true, sortable: true },
    ],
    onRowDoubleClicked: function (event) {
      const index = tracks.findIndex((track) => track.url === event.data.url);
      loadAudio(index);
    },
    rowData: [],
  };

  const eGridDiv = document.querySelector("#myGrid");

  new Grid(eGridDiv, gridOptions);

  const button1 = document.getElementById("loadButton");
  button1.addEventListener("click", loadAudioFiles);
  const button2 = document.getElementById("prevButton");
  button2.addEventListener("click", previousTrack);
  const button3 = document.getElementById("pauseButton");
  button3.addEventListener("click", pauseAudio);
  const button4 = document.getElementById("nextButton");
  button4.addEventListener("click", nextTrack);
  let mouseDown = false;

  const progressBar = document.getElementById("progressBar");
  progressBar.addEventListener("mousedown", function (e) {
    mouseDown = true;
    const progressBarWidth = this.offsetWidth;
    const clickPosition = e.pageX - this.offsetLeft;
    const percentage = clickPosition / progressBarWidth;
    audio.currentTime = audio.duration * percentage;
  });

  progressBar.addEventListener("mousemove", function (e) {
    if (mouseDown) {
      const progressBarWidth = this.offsetWidth;
      const clickPosition = e.pageX - this.offsetLeft;
      const percentage = clickPosition / progressBarWidth;
      audio.currentTime = audio.duration * percentage;
    }
  });

  progressBar.addEventListener("mouseup", function (e) {
    mouseDown = false;
  });

  progressBar.addEventListener("mouseleave", function (e) {
    mouseDown = false;
  });

  document.getElementById("volumeSlider").oninput = function () {
    const maxVolumeLevel = 1;
    const minVolumeLevel = 0.01; // almost silent
    const position = this.value;

    // Special case for minimum position of slider
    if (position <= 0) {
      audio.volume = 0;
    } else {
      // Calculate volume on a log scale
      const scale = Math.log(maxVolumeLevel / minVolumeLevel);
      audio.volume = minVolumeLevel * Math.exp(scale * position);
    }
  };

  async function getDirectory() {
    libraryDirectory = await window.showDirectoryPicker({
      id: "libraryDirectory",
      startIn: "music",
    });
    for await (const entry of libraryDirectory.values()) {
      if (entry.kind === "directory") {
        // Can display these when re-prompting to indicate the chosen library folder
        console.log(`Found subdirectory: ${entry.name}`);
      }
    }
  }

  function formatDuration(duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.round(duration % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  async function getAudioFileHandles(directoryHandle, relativePath = "") {
    let fileHandles = [];
    for await (const entry of directoryHandle.values()) {
      const entryRelativePath = `${relativePath}/${entry.name}`;
      if (entry.kind === "file") {
        const file = await entry.getFile();
        if (!file.type.startsWith("audio/")) {
          continue;
        }
        file.relativePath = entryRelativePath;
        fileHandles.push(file);
      } else if (entry.kind === "directory") {
        const subDirFileHandles = await getAudioFileHandles(
          entry,
          entryRelativePath
        );
        fileHandles = fileHandles.concat(subDirFileHandles);
      }
    }
    return fileHandles;
  }

  async function loadAudioFiles() {
    if (!libraryDirectory) {
      await getDirectory();
    }

    totalAudioFiles = 0;
    document.getElementById("progressBar").value = 0;
    document.getElementById("progressText").innerHTML = "Loading...";

    const fileHandles = await getAudioFileHandles(libraryDirectory);
    totalAudioFiles = fileHandles.length;

    const metadataPromises = fileHandles.map(getMetadata);

    for (let i = 0; i < fileHandles.length; i++) {
      let metadata = await metadataPromises[i];

      if (!metadata) {
        metadata = await musicMetadata.parseBlob(fileHandles[i]);
        metadata.name = fileHandles[i].relativePath;
        let tx = db.transaction("metadata", "readwrite");
        let store = tx.objectStore("metadata");
        store.add(metadata);
      }

      const url = URL.createObjectURL(fileHandles[i]);

      let track;
      if (metadata.native && metadata.native.iTunes) {
        const iTunesData = new Map(
          metadata.native.iTunes.map((item) => [item.id, item.value])
        );
        track = {
          title: iTunesData.get("\u00A9nam"),
          artist: iTunesData.get("\u00A9ART"),
          "album artist": iTunesData.get("aART"),
          album: iTunesData.get("\u00A9alb"),
          length: formatDuration(metadata.format.duration),
          genre: iTunesData.get("gnre") || iTunesData.get("\u00A9gen"),
          year: iTunesData.get("\u00A9day"),
          url: url,
          index: tracks.length,
        };
      } else {
        track = {
          title: metadata.common.title,
          artist:
            metadata.common.artists ||
            (metadata.common.artist && [metadata.common.artist]) ||
            (metadata.common.albumartist && [metadata.common.albumartist]),
          "album artist": metadata.common.albumartist,
          album: metadata.common.album,
          length: formatDuration(metadata.format.duration),
          genre: metadata.common.genre
            ? metadata.common.genre.join(", ")
            : null,
          year: metadata.common.year,
          url: url,
          index: tracks.length,
          // disk: common.disk,
          // track: common.track.no,
        };
      }

      tracks.push(track);
      gridOptions.api.applyTransaction({ add: [track] });

      const progress = ((i + 1) / totalAudioFiles) * 100;
      document.getElementById("progressBar").value = progress;
      document.getElementById("progressText").innerHTML =
        "Loading... (" + (totalAudioFiles - i - 1) + " tracks left)";
    }
    document.getElementById("progressText").innerHTML = "Done!";
  }

  async function getMetadata(file) {
    let metadata;
    let tx = db.transaction("metadata", "readonly");
    let store = tx.objectStore("metadata");
    let request = store.get(file.relativePath);

    await new Promise((resolve, reject) => {
      request.onsuccess = function () {
        if (request.result) {
          metadata = request.result;
        }
        resolve();
      };
      request.onerror = function () {
        reject(request.error);
      };
    });

    return metadata;
  }

  function loadAudio(index) {
    currentTrackIndex = index;
    gridOptions.api.redrawRows();
    console.log(index);
    if (audio) {
      audio.pause();
      document.getElementById("playPauseIcon").src = "assets/play.svg";
    }
    const track = tracks[index];
    if (track) {
      audio = new Audio(track.url);
      audio.play();
      document.getElementById("playPauseIcon").src = "assets/pause.svg";
      document.getElementById("currentTrackTitle").textContent = track.title;
      document.getElementById("currentTrackArtist").textContent = track.artist;
      currentTrackIndex = index;
      audio.addEventListener("timeupdate", function () {
        const progressBar = document.getElementById("progressBar");
        const percentage = (audio.currentTime / audio.duration) * 100;
        progressBar.value = percentage;
      });
      audio.addEventListener("ended", function () {
        nextTrack();
      });
    }
  }

  function nextTrack() {
    if (currentTrackIndex !== null && currentTrackIndex < tracks.length - 1) {
      loadAudio(currentTrackIndex + 1);
    }
  }

  function previousTrack() {
    if (currentTrackIndex > 0) {
      loadAudio(currentTrackIndex - 1);
    }
  }

  function pauseAudio() {
    if (audio && !audio.paused) {
      audio.pause();
      document.getElementById("playPauseIcon").src = "assets/play.svg";
    } else if (audio) {
      audio.play();
      document.getElementById("playPauseIcon").src = "assets/pause.svg";
    }
  }
});
