using BobTile.Core.Models;

namespace BobTile.Core.ImageProcessing;

public static class ImageValidator
{
    public static List<string> ValidateTileSizes(IEnumerable<TileImage> tiles, int expectedSize)
    {
        var mismatches = new List<string>();

        foreach (var tile in tiles)
        {
            if (tile.Width != expectedSize || tile.Height != expectedSize)
            {
                mismatches.Add($"{tile.FileName}: {tile.Width}x{tile.Height} (expected {expectedSize}x{expectedSize})");
            }
        }

        return mismatches;
    }

    public static bool IsValidTileSize(TileImage tile, int expectedSize)
    {
        return tile.Width == expectedSize && tile.Height == expectedSize;
    }
}
