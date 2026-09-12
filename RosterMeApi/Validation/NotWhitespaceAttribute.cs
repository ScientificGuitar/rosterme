using System.ComponentModel.DataAnnotations;

namespace RosterMeApi.Validation;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed class NotWhitespaceAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is null) return ValidationResult.Success;
        if (value is string s && string.IsNullOrWhiteSpace(s))
        {
            var name = validationContext.MemberName ?? "Value";
            return new ValidationResult(
                ErrorMessage ?? $"{name} must not be whitespace.",
                new[] { validationContext.MemberName ?? string.Empty });
        }
        return ValidationResult.Success;
    }
}
