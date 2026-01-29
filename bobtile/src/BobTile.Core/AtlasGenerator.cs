using BobTile.Core.ImageProcessing;
using BobTile.Core.Models;
using SkiaSharp;

namespace BobTile.Core;

public static class AtlasGenerator
{
    public static SKBitmap CreateAtlas(
        IReadOnlyList<TileImage> tiles,
        int tileSize,
        int columns,
        int padding,
        bool extrudeEdges,
        bool resizeToTileSize,
        IProgress<int>? progress = null)
    {
        int tileCount = tiles.Count;
        int rows = (int)Math.Ceiling((double)tileCount / columns);

        int extrudeOffset = extrudeEdges ? 1 : 0;
        int cellSize = tileSize + (2 * padding) + (2 * extrudeOffset);

        int atlasWidth = columns * cellSize;
        int atlasHeight = rows * cellSize;

        var atlas = new SKBitmap(atlasWidth, atlasHeight, SKColorType.Rgba8888, SKAlphaType.Premul);

        using var canvas = new SKCanvas(atlas);
        canvas.Clear(SKColors.Transparent);

        for (int i = 0; i < tiles.Count; i++)
        {
            var tile = tiles[i];
            int col = i % columns;
            int row = i / columns;

            int tileX = col * cellSize + padding + extrudeOffset;
            int tileY = row * cellSize + padding + extrudeOffset;

            var bitmapToDraw = tile.Bitmap;
            bool shouldDispose = false;

            if (resizeToTileSize && (tile.Width != tileSize || tile.Height != tileSize))
            {
                bitmapToDraw = ImageResizer.ResizeNearestNeighbor(tile.Bitmap, tileSize, tileSize);
                shouldDispose = true;
            }

            canvas.DrawBitmap(bitmapToDraw, tileX, tileY);

            if (extrudeEdges)
            {
                EdgeExtruder.ExtrudeEdges(canvas, bitmapToDraw, tileX, tileY);
            }

            if (shouldDispose)
            {
                bitmapToDraw.Dispose();
            }

            progress?.Report((int)((i + 1) * 100.0 / tiles.Count));
        }

        return atlas;
    }

    /// <summary>
    /// Creates an atlas from multiple groups of tiles, where each group starts on a new row.
    /// Remaining columns in a row are left transparent if a group doesn't fill the row completely.
    /// </summary>
    public static SKBitmap CreateAtlasWithGroups(
        IReadOnlyList<IReadOnlyList<TileImage>> tileGroups,
        int tileSize,
        int columns,
        int padding,
        bool extrudeEdges,
        bool resizeToTileSize,
        IProgress<int>? progress = null)
    {
        // Calculate total rows needed
        int totalRows = 0;
        foreach (var group in tileGroups)
        {
            int groupRows = (int)Math.Ceiling((double)group.Count / columns);
            totalRows += groupRows;
        }

        int extrudeOffset = extrudeEdges ? 1 : 0;
        int cellSize = tileSize + (2 * padding) + (2 * extrudeOffset);

        int atlasWidth = columns * cellSize;
        int atlasHeight = totalRows * cellSize;

        var atlas = new SKBitmap(atlasWidth, atlasHeight, SKColorType.Rgba8888, SKAlphaType.Premul);

        using var canvas = new SKCanvas(atlas);
        canvas.Clear(SKColors.Transparent);

        int totalTiles = tileGroups.Sum(g => g.Count);
        int tilesProcessed = 0;
        int currentRow = 0;

        foreach (var group in tileGroups)
        {
            int colInGroup = 0;
            int rowInGroup = 0;

            foreach (var tile in group)
            {
                int col = colInGroup;
                int row = currentRow + rowInGroup;

                int tileX = col * cellSize + padding + extrudeOffset;
                int tileY = row * cellSize + padding + extrudeOffset;

                var bitmapToDraw = tile.Bitmap;
                bool shouldDispose = false;

                if (resizeToTileSize && (tile.Width != tileSize || tile.Height != tileSize))
                {
                    bitmapToDraw = ImageResizer.ResizeNearestNeighbor(tile.Bitmap, tileSize, tileSize);
                    shouldDispose = true;
                }

                canvas.DrawBitmap(bitmapToDraw, tileX, tileY);

                if (extrudeEdges)
                {
                    EdgeExtruder.ExtrudeEdges(canvas, bitmapToDraw, tileX, tileY);
                }

                if (shouldDispose)
                {
                    bitmapToDraw.Dispose();
                }

                tilesProcessed++;
                progress?.Report((int)(tilesProcessed * 100.0 / totalTiles));

                // Move to next position
                colInGroup++;
                if (colInGroup >= columns)
                {
                    colInGroup = 0;
                    rowInGroup++;
                }
            }

            // Move to next group's starting row
            int groupRows = (int)Math.Ceiling((double)group.Count / columns);
            currentRow += groupRows;
        }

        return atlas;
    }

    /// <summary>
    /// Calculates the total number of rows needed when groups start on new rows.
    /// </summary>
    public static int CalculateRowsWithGroups(IReadOnlyList<int> tileCounts, int columns)
    {
        int totalRows = 0;
        foreach (var count in tileCounts)
        {
            totalRows += (int)Math.Ceiling((double)count / columns);
        }
        return totalRows;
    }

    public static (int Rows, int Columns, int Width, int Height) CalculateDimensions(
        int tileCount,
        int tileSize,
        int columns,
        int padding,
        bool extrudeEdges)
    {
        int actualColumns = columns > 0 ? columns : (int)Math.Ceiling(Math.Sqrt(tileCount));
        int rows = (int)Math.Ceiling((double)tileCount / actualColumns);

        int extrudeOffset = extrudeEdges ? 1 : 0;
        int cellSize = tileSize + (2 * padding) + (2 * extrudeOffset);

        int atlasWidth = actualColumns * cellSize;
        int atlasHeight = rows * cellSize;

        return (rows, actualColumns, atlasWidth, atlasHeight);
    }

    public static (int Rows, int Columns, int Width, int Height) CalculateDimensionsWithGroups(
        IReadOnlyList<int> tileCounts,
        int tileSize,
        int columns,
        int padding,
        bool extrudeEdges)
    {
        int actualColumns = columns > 0 ? columns : (int)Math.Ceiling(Math.Sqrt(tileCounts.Sum()));
        int rows = CalculateRowsWithGroups(tileCounts, actualColumns);

        int extrudeOffset = extrudeEdges ? 1 : 0;
        int cellSize = tileSize + (2 * padding) + (2 * extrudeOffset);

        int atlasWidth = actualColumns * cellSize;
        int atlasHeight = rows * cellSize;

        return (rows, actualColumns, atlasWidth, atlasHeight);
    }
}
