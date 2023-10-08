import { Grid } from "ag-grid-community";
import { parseBlob } from "music-metadata-browser";

import dbFunctions from "./db.js";
import colDefs from "./colDefs.js";

document.addEventListener("DOMContentLoaded", (event) => {
  let currentTrackIndex = null;
  let tracks = [];
  let audio;
  let libraryDirectory;
  let isShuffle = false;
  let isRepeat = false;
  let isRepeatOne = false;
  let progressMouseDown = false;
  let volumeMouseDown = false;

  dbFunctions.init();

  const gridOptions = {
    suppressCellFocus: true,
    suppressDragLeaveHidesColumns: true,
    rowSelection: "multiple",
    getRowStyle: function (params) {
      if (params.node.rowIndex === currentTrackIndex) {
        return { fontWeight: "bold" };
      } else {
        return null;
      }
    },
    columnDefs: colDefs,
    defaultColDef: {
      resizable: true,
      sortable: true,
    },
    onRowDoubleClicked: function (event) {
      const index = tracks.findIndex((track) => track.url === event.data.url);
      loadAudio(index);
    },
    overlayLoadingTemplate: '<span id="progressText">Loading...</span>',
    overlayNoRowsTemplate: `Your library is empty, click the upload icon to add some files.`,
    rowData: [],
  };

  const contextMenu = document.getElementById("contextMenu");
  let menuItemsHTML = "<div>";
  const columnDefs = [...gridOptions.columnDefs].sort((a, b) =>
    a.headerName.localeCompare(b.headerName)
  );
  for (let colDef of columnDefs) {
    menuItemsHTML += `<div><input type="checkbox" id="${colDef.field}" ${
      !colDef.hide ? "checked" : ""
    } />${colDef.headerName}</div>`;
  }
  menuItemsHTML += "</div>";
  contextMenu.innerHTML = menuItemsHTML;
  document.body.appendChild(contextMenu);
  for (let colDef of gridOptions.columnDefs) {
    document
      .getElementById(colDef.field)
      .addEventListener("change", function () {
        gridOptions.columnApi.setColumnVisible(colDef.field, this.checked);
      });
  }

  const eGridDiv = document.querySelector("#myGrid");

  new Grid(eGridDiv, gridOptions);

  gridOptions.api.addEventListener("sortChanged", function () {
    const newTracks = [];
    // (This is bad)
    for (let i = 0; i < gridOptions.api.getDisplayedRowCount(); i++) {
      const rowNode = gridOptions.api.getDisplayedRowAtIndex(i);
      const track = rowNode.data;
      newTracks.push(track);
    }
    const currentTrackUrl = tracks[currentTrackIndex].url;
    tracks = newTracks;
    currentTrackIndex = tracks.findIndex(
      (track) => track.url === currentTrackUrl
    );
    gridOptions.api.redrawRows();
  });

  var headerViewport = document.querySelector(".ag-header-viewport");
  headerViewport.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    contextMenu.style.display = "block";
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
  });

  window.addEventListener("mousedown", function (e) {
    if (!contextMenu.contains(e.target)) {
      contextMenu.style.display = "none";
    }
  });

  const button1 = document.getElementById("loadButton");
  button1.addEventListener("click", loadAudioFiles);
  const button2 = document.getElementById("prevButton");
  button2.addEventListener("click", previousTrack);
  const button3 = document.getElementById("pauseButton");
  button3.addEventListener("click", pauseAudio);
  const button4 = document.getElementById("nextButton");
  button4.addEventListener("click", function () {
    nextTrack(false);
  });

  document
    .getElementById("shuffleButton")
    .addEventListener("click", function () {
      this.classList.toggle("selected");
      isShuffle = !isShuffle;
    });

  document
    .getElementById("repeatButton")
    .addEventListener("click", function () {
      var repeatOne = document.getElementById("repeatOne");

      if (
        this.classList.contains("selected") &&
        repeatOne.style.display === "none"
      ) {
        repeatOne.style.display = "inline";
        isRepeatOne = true;
        isRepeat = false;
      } else if (this.classList.contains("selected")) {
        this.classList.remove("selected");
        repeatOne.style.display = "none";
        isRepeatOne = false;
      } else {
        this.classList.add("selected");
        isRepeat = true;
      }
    });

  function getOffsetLeft(elem) {
    var offsetLeft = 0;
    do {
      if (!isNaN(elem.offsetLeft)) {
        offsetLeft += elem.offsetLeft;
      }
    } while ((elem = elem.offsetParent));
    return offsetLeft;
  }

  const progressBar = document.getElementById("progressBar");
  const volumeBar = document.getElementById("volumeControl");

  progressBar.addEventListener("mousedown", function (e) {
    if (audio) {
      progressMouseDown = true;
      const progressBarWidth = this.offsetWidth;
      const clickPosition = e.pageX - getOffsetLeft(this);
      const percentage = (clickPosition / progressBarWidth) * 100;
      progressBar.value = isFinite(percentage) ? percentage : 0;
      const duration = Math.min(
        audio.duration,
        Math.max(0, (clickPosition / progressBarWidth) * audio.duration)
      );
      document.getElementById("elapsed").textContent = formatDuration(duration);
    }
  });

  document.addEventListener("mousemove", function (e) {
    if (progressMouseDown) {
      const progressBarWidth = progressBar.offsetWidth;
      const clickPosition = e.pageX - getOffsetLeft(progressBar);
      const percentage = (clickPosition / progressBarWidth) * 100;
      progressBar.value = isFinite(percentage) ? percentage : 0;
      const duration = Math.min(
        audio.duration,
        Math.max(0, (clickPosition / progressBarWidth) * audio.duration)
      );
      document.getElementById("elapsed").textContent = formatDuration(duration);
    }
  });

  document.addEventListener("mouseup", function (e) {
    if (progressMouseDown) {
      progressMouseDown = false;
      const progressBarWidth = progressBar.offsetWidth;
      const clickPosition = e.pageX - getOffsetLeft(progressBar);
      const percentage = clickPosition / progressBarWidth;
      audio.currentTime = audio.duration * percentage;
    }
  });

  document
    .getElementById("currentTrackTitle")
    .addEventListener("click", function () {
      gridOptions.api.ensureIndexVisible(currentTrackIndex, "middle");
    });

  function setVolume(newValue) {
    if (audio) {
      const maxVolumeLevel = 1;
      const minVolumeLevel = 0.01;
      if (newValue <= 0) {
        audio.volume = 0;
      } else {
        // Calculate volume on a log scale
        const scale = Math.log(maxVolumeLevel / minVolumeLevel);
        const newVolume = minVolumeLevel * Math.exp(scale * newValue);
        if (newVolume > 1) {
          audio.volume = 1;
        } else {
          audio.volume = newVolume;
        }
      }
    }
  }

  function updateVolumeSlider(e) {
    const progressBarWidth = volumeBar.offsetWidth;
    const clickPosition = e.pageX - getOffsetLeft(volumeBar);
    volumeBar.value = clickPosition / progressBarWidth;
    var volumeHandle = document.getElementById("volumeHandle");
    volumeHandle.style.left = volumeBar.value * 100 + "%";
    setVolume(volumeBar.value);
  }

  volumeBar.addEventListener("mousedown", function (e) {
    volumeMouseDown = true;
    updateVolumeSlider(e);
  });

  document
    .getElementById("volumeHandle")
    .addEventListener("mousedown", function (e) {
      volumeMouseDown = true;
      updateVolumeSlider(e);
    });

  document.addEventListener("mousemove", function (e) {
    if (volumeMouseDown) {
      updateVolumeSlider(e);
    }
  });

  document.addEventListener("mouseup", function (e) {
    volumeMouseDown = false;
  });

  async function getDirectory() {
    libraryDirectory = await window.showDirectoryPicker({
      id: "libraryDirectory",
      startIn: "music",
    });
    console.log(libraryDirectory.name);
    for await (const entry of libraryDirectory.values()) {
      if (entry.kind === "directory") {
        console.log(`\t${entry.name}`);
      }
    }
  }

  function formatDuration(duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  async function getAudioFileHandles(directoryHandle, relativePath = "") {
    let fileHandles = [];
    for await (const entry of directoryHandle.values()) {
      const entryRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : `${directoryHandle.name}/${entry.name}`;
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

    let totalAudioFiles = 0;

    const fileHandles = await getAudioFileHandles(libraryDirectory);
    totalAudioFiles = fileHandles.length;
    let progress = document.getElementById("progressText");
    if (progress != null) {
      progress.textContent =
        "Loading... (0/" + totalAudioFiles + " files scanned)";
    }
    const metadataPromises = fileHandles.map(dbFunctions.getMetadata);

    for (let i = 0; i < fileHandles.length; i++) {
      let track = await metadataPromises[i];
      const url = URL.createObjectURL(fileHandles[i]);
      if (!track) {
        let metadata = await parseBlob(fileHandles[i]);

        let coverArt;
        if (metadata.common.picture && metadata.common.picture[0]) {
          let picture = metadata.common.picture[0];
          coverArt = await dbFunctions.storeCoverArtGetHash(
            `data:${picture.format};base64,${picture.data.toString("base64")}`
          );
        }

        if (metadata.native && metadata.native["ID3v2.3"]) {
          const ID3v23Data = new Map(
            metadata.native["ID3v2.3"].map((item) => [item.id, item.value])
          );
          track = {
            name: fileHandles[i].relativePath,
            title: ID3v23Data.get("TIT2"),
            artist: ID3v23Data.get("TPE1"),
            "album artist": ID3v23Data.get("TPE2"),
            album: ID3v23Data.get("TALB"),
            length: metadata.format.duration,
            genre: ID3v23Data.get("TCON"),
            year: ID3v23Data.get("TYER"),
            index: tracks.length,
            coverArt: coverArt,
            disc: Number(ID3v23Data.get("TPOS").split("/")[0]),
            track: Number(ID3v23Data.get("TRCK").split("/")[0]),
            composer: ID3v23Data.get("TCOM"),
            comments: ID3v23Data.get("COMM")
              ? ID3v23Data.get("COMM").text
              : null,
          };
        } else if (metadata.native && metadata.native.iTunes) {
          const iTunesData = new Map(
            metadata.native.iTunes.map((item) => [item.id, item.value])
          );
          track = {
            name: fileHandles[i].relativePath,
            title: iTunesData.get("\u00A9nam"),
            artist: iTunesData.get("\u00A9ART"),
            "album artist": iTunesData.get("aART"),
            album: iTunesData.get("\u00A9alb"),
            length: metadata.format.duration,
            genre: iTunesData.get("gnre") || iTunesData.get("\u00A9gen"),
            year: iTunesData.get("\u00A9day"),
            index: tracks.length,
            coverArt: coverArt,
            disc: Number(iTunesData.get("disk").split("/")[0]),
            track: Number(iTunesData.get("trkn").split("/")[0]),
            composer: iTunesData.get("\u00A9wrt"),
            comments: iTunesData.get("\u00A9cmt"),
          };
        } else {
          track = {
            name: fileHandles[i].relativePath,
            title: metadata.common.title,
            artist:
              metadata.common.artists ||
              (metadata.common.artist && [metadata.common.artist]) ||
              (metadata.common.albumartist && [metadata.common.albumartist]),
            "album artist": metadata.common.albumartist,
            album: metadata.common.album,
            length: metadata.format.duration,
            genre: metadata.common.genre
              ? metadata.common.genre.join(", ")
              : null,
            year: metadata.common.year,
            index: tracks.length,
            coverArt: coverArt,
            disk: Number(common.disk),
            track: Number(common.track.no),
            composer: metadata.common.composer,
            comments: metadata.common.comment,
          };
        }
        dbFunctions.storeMetadata(track);
      }
      track.url = url;
      tracks.push(track);

      progress.innerHTML =
        "Loading... (" + (i - 1) + "/" + totalAudioFiles + " files scanned)";
      gridOptions.api.applyTransaction({ add: [track] });
    }
    progress.innerHTML = "";
  }

  async function loadAudio(index) {
    currentTrackIndex = index;
    gridOptions.api.redrawRows();
    if (audio) {
      audio.pause();
      document.getElementById("playPauseIcon").src = "assets/play.svg";
    }
    const track = tracks[index];
    if (track) {
      audio = new Audio(track.url);
      setVolume(volumeBar.value);
      audio.play();

      document.getElementById("playPauseIcon").src = "assets/pause.svg";
      document.getElementById("currentTrackTitle").textContent = track.title;
      document.getElementById("currentTrackArtist").textContent = track.artist;
      document.getElementById("duration").textContent = formatDuration(
        track.length
      );
      currentTrackIndex = index;
      audio.addEventListener("timeupdate", function () {
        if (!progressMouseDown) {
          document.getElementById("elapsed").textContent = formatDuration(
            audio.currentTime
          );
          const progressBar = document.getElementById("progressBar");
          const percentage = (audio.currentTime / audio.duration) * 100;
          progressBar.value = isFinite(percentage) ? percentage : 0;
        }
      });
      audio.addEventListener("ended", function () {
        nextTrack(true);
      });

      const coverArtData = await dbFunctions.getCoverArt(track.coverArt);
      document.getElementById("currentTrackArt").src = coverArtData;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album,
          // TODO: fix type
          artwork: [{ src: coverArtData, sizes: "512x512", type: "image/png" }],
        });
        navigator.mediaSession.setActionHandler("play", function () {
          pauseAudio();
        });

        navigator.mediaSession.setActionHandler("pause", function () {
          pauseAudio();
        });

        navigator.mediaSession.setActionHandler("previoustrack", function () {
          previousTrack();
        });

        navigator.mediaSession.setActionHandler("nexttrack", function () {
          nextTrack(false);
        });
      }
    }
  }

  function nextTrack(autoNext) {
    let nextTrackIndex = null;

    if (isShuffle) {
      nextTrackIndex = Math.floor(Math.random() * tracks.length);
    }
    if (autoNext && isRepeatOne) {
      nextTrackIndex = currentTrackIndex;
    } else if (
      !isShuffle &&
      currentTrackIndex !== null &&
      currentTrackIndex < tracks.length - 1
    ) {
      nextTrackIndex = currentTrackIndex + 1;
    } else if (
      !isShuffle &&
      isRepeat &&
      currentTrackIndex === tracks.length - 1
    ) {
      nextTrackIndex = 0;
    }
    if (!autoNext && isRepeatOne) {
      var repeatOne = document.getElementById("repeatOne");
      repeatOne.style.display = "none";
      isRepeatOne = false;
      isRepeat = true;
    }

    if (nextTrackIndex !== null) {
      loadAudio(nextTrackIndex);
    }
  }

  function previousTrack() {
    let previousTrackIndex = null;

    if (audio.currentTime > 2) {
      audio.currentTime = 0;
    } else if (isShuffle) {
      previousTrackIndex = Math.floor(Math.random() * tracks.length);
    } else if (currentTrackIndex > 0) {
      previousTrackIndex = currentTrackIndex - 1;
    } else if (isRepeat && currentTrackIndex === 0) {
      previousTrackIndex = tracks.length - 1;
    }
    if (previousTrackIndex !== null) {
      if (isRepeatOne) {
        var repeatOne = document.getElementById("repeatOne");
        repeatOne.style.display = "none";
        isRepeatOne = false;
        isRepeat = true;
      }
      loadAudio(previousTrackIndex);
    }
  }

  function pauseAudio() {
    if (audio && !audio.paused) {
      audio.pause();
      document.getElementById("playPauseIcon").src = "assets/play.svg";
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    } else if (audio) {
      audio.play();
      document.getElementById("playPauseIcon").src = "assets/pause.svg";
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    }
  }
});
