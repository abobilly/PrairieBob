using System.Windows;
using System.Windows.Controls;
using Microsoft.Win32;

namespace BobTile.Services;

public class DialogService : IDialogService
{
    public string? BrowseFolder(string? initialPath = null)
    {
        var dialog = new OpenFolderDialog
        {
            Title = "Select Folder",
            InitialDirectory = initialPath ?? Environment.GetFolderPath(Environment.SpecialFolder.MyPictures)
        };

        return dialog.ShowDialog() == true ? dialog.FolderName : null;
    }

    public string[]? SelectImageFiles(string? initialPath = null)
    {
        var dialog = new OpenFileDialog
        {
            Title = "Select Image Files",
            Filter = "Image Files|*.png;*.webp|PNG Files|*.png|WebP Files|*.webp|All Files|*.*",
            Multiselect = true,
            InitialDirectory = initialPath ?? Environment.GetFolderPath(Environment.SpecialFolder.MyPictures)
        };

        return dialog.ShowDialog() == true ? dialog.FileNames : null;
    }

    public int? PromptForInt(string title, string message, int initialValue)
    {
        var window = new Window
        {
            Title = title,
            SizeToContent = SizeToContent.WidthAndHeight,
            ResizeMode = ResizeMode.NoResize,
            WindowStartupLocation = WindowStartupLocation.CenterOwner,
            Owner = Application.Current?.MainWindow,
            MinWidth = 320
        };

        var root = new StackPanel
        {
            Margin = new Thickness(16)
        };

        root.Children.Add(new TextBlock
        {
            Text = message,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 8)
        });

        var input = new TextBox
        {
            Text = initialValue.ToString(),
            MinWidth = 120
        };
        root.Children.Add(input);

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 12, 0, 0)
        };

        var okButton = new Button
        {
            Content = "OK",
            IsDefault = true,
            MinWidth = 80,
            Margin = new Thickness(0, 0, 8, 0)
        };

        var cancelButton = new Button
        {
            Content = "Cancel",
            IsCancel = true,
            MinWidth = 80
        };

        okButton.Click += (_, _) =>
        {
            if (int.TryParse(input.Text, out int value) && value > 0)
            {
                window.Tag = value;
                window.DialogResult = true;
            }
            else
            {
                MessageBox.Show("Please enter a positive whole number.", "Invalid value",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        };

        buttons.Children.Add(okButton);
        buttons.Children.Add(cancelButton);

        root.Children.Add(buttons);

        window.Content = root;

        bool? result = window.ShowDialog();
        if (result == true && window.Tag is int parsed)
        {
            return parsed;
        }

        return null;
    }

    public void ShowError(string title, string message)
    {
        MessageBox.Show(message, title, MessageBoxButton.OK, MessageBoxImage.Error);
    }

    public void ShowInfo(string title, string message)
    {
        MessageBox.Show(message, title, MessageBoxButton.OK, MessageBoxImage.Information);
    }

    public bool Confirm(string title, string message)
    {
        return MessageBox.Show(message, title, MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes;
    }
}
