using System.IO;
using CommunityToolkit.Mvvm.ComponentModel;

namespace BobTile.ViewModels;

public partial class TilesetSelection : ObservableObject
{
    public TilesetSelection(string path, int inputTileSize)
    {
        _filePath = path;
        _inputTileSize = inputTileSize;
    }

    [ObservableProperty]
    private string _filePath;

    [ObservableProperty]
    private int _inputTileSize;

    public string FileName => System.IO.Path.GetFileName(FilePath);

    partial void OnFilePathChanged(string value)
    {
        OnPropertyChanged(nameof(FileName));
    }
}
