export function formatDuration(duration) {
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

export function getMetadata(metadata, coverHash, tracks, path) {
  if (metadata.native && metadata.native["ID3v2.3"]) {
    const ID3v23Data = new Map(
      metadata.native["ID3v2.3"].map((item) => [item.id, item.value])
    );
    return {
      name: path,
      title: ID3v23Data.get("TIT2"),
      artist: ID3v23Data.get("TPE1"),
      "album artist": ID3v23Data.get("TPE2"),
      album: ID3v23Data.get("TALB"),
      length: metadata.format.duration,
      genre: ID3v23Data.get("TCON"),
      year: ID3v23Data.get("TYER"),
      index: tracks,
      coverArt: coverHash,
      disc: Number(ID3v23Data.get("TPOS").split("/")[0]),
      track: Number(ID3v23Data.get("TRCK").split("/")[0]),
      composer: ID3v23Data.get("TCOM"),
      comments: ID3v23Data.get("COMM") ? ID3v23Data.get("COMM").text : null,
    };
  } else if (metadata.native && metadata.native.iTunes) {
    const iTunesData = new Map(
      metadata.native.iTunes.map((item) => [item.id, item.value])
    );
    return {
      name: path,
      title: iTunesData.get("\u00A9nam"),
      artist: iTunesData.get("\u00A9ART"),
      "album artist": iTunesData.get("aART"),
      album: iTunesData.get("\u00A9alb"),
      length: metadata.format.duration,
      genre: iTunesData.get("gnre") || iTunesData.get("\u00A9gen"),
      year: iTunesData.get("\u00A9day"),
      index: tracks,
      coverArt: coverHash,
      disc: Number(iTunesData.get("disk").split("/")[0]),
      track: Number(iTunesData.get("trkn").split("/")[0]),
      composer: iTunesData.get("\u00A9wrt"),
      comments: iTunesData.get("\u00A9cmt"),
    };
  } else {
    return {
      name: path,
      title: metadata.common.title,
      artist:
        metadata.common.artists ||
        (metadata.common.artist && [metadata.common.artist]) ||
        (metadata.common.albumartist && [metadata.common.albumartist]),
      "album artist": metadata.common.albumartist,
      album: metadata.common.album,
      length: metadata.format.duration,
      genre: metadata.common.genre ? metadata.common.genre.join(", ") : null,
      year: metadata.common.year,
      index: tracks,
      coverArt: coverHash,
      disk: Number(common.disk),
      track: Number(common.track.no),
      composer: metadata.common.composer,
      comments: metadata.common.comment,
    };
  }
}
