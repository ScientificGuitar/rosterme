using System.ComponentModel.DataAnnotations;
using System.Reflection;
using Microsoft.AspNetCore.Http;

namespace RosterMeApi.Validation;

public sealed class ValidateDtoFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        var visited = new HashSet<object>(ReferenceEqualityComparer.Instance);

        foreach (var arg in context.Arguments)
        {
            if (arg is null) continue;
            if (!IsCandidateType(arg.GetType())) continue;

            ValidateObject(arg, string.Empty, errors, visited);
        }

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(
                errors.ToDictionary(kv => kv.Key, kv => kv.Value.ToArray()));
        }

        return await next(context);
    }

    private static void ValidateObject(
        object instance,
        string prefix,
        Dictionary<string, List<string>> errors,
        HashSet<object> visited)
    {
        if (instance is null) return;
        if (!IsCandidateType(instance.GetType())) return;
        if (!visited.Add(instance)) return;

        var ctx = new ValidationContext(instance);
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(instance, ctx, results, validateAllProperties: true);

        foreach (var result in results)
        {
            if (result is null) continue;

            var members = result.MemberNames?.Any() == true
                ? result.MemberNames
                : new[] { string.Empty };

            foreach (var member in members)
            {
                var key = string.IsNullOrEmpty(prefix)
                    ? member
                    : string.IsNullOrEmpty(member)
                        ? prefix
                        : $"{prefix}.{member}";

                if (!errors.TryGetValue(key, out var list))
                {
                    list = new List<string>();
                    errors[key] = list;
                }
                list.Add(result.ErrorMessage ?? "Invalid value.");
            }
        }

        foreach (var prop in instance.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (prop.GetIndexParameters().Length > 0) continue;
            if (!prop.CanRead) continue;
            var value = prop.GetValue(instance);
            if (value is null) continue;
            if (!IsCandidateType(prop.PropertyType)) continue;

            var subPrefix = string.IsNullOrEmpty(prefix)
                ? prop.Name
                : $"{prefix}.{prop.Name}";

            if (value is string s) continue;
            if (value is System.Collections.IEnumerable enumerable)
            {
                var i = 0;
                foreach (var item in enumerable)
                {
                    if (item is null) { i++; continue; }
                    if (!IsCandidateType(item.GetType())) { i++; continue; }
                    ValidateObject(item, $"{subPrefix}[{i}]", errors, visited);
                    i++;
                }
            }
            else
            {
                ValidateObject(value, subPrefix, errors, visited);
            }
        }
    }

    private static bool IsCandidateType(Type type)
    {
        if (type is null) return false;
        if (IsSimpleType(type)) return false;
        if (type.IsPrimitive || type.IsEnum) return false;

        if (typeof(System.Collections.IEnumerable).IsAssignableFrom(type) && type != typeof(string))
            return true;

        if (HasValidationMetadata(type)) return true;
        return false;
    }

    private static bool HasValidationMetadata(Type type)
    {
        if (typeof(IValidatableObject).IsAssignableFrom(type)) return true;
        if (type.GetCustomAttribute<MetadataTypeAttribute>() is not null) return true;

        foreach (var prop in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            foreach (var attr in prop.GetCustomAttributes(inherit: true))
            {
                if (attr is ValidationAttribute) return true;
            }
        }

        foreach (var ctor in type.GetConstructors())
        {
            foreach (var param in ctor.GetParameters())
            {
                foreach (var attr in param.GetCustomAttributes(inherit: true))
                {
                    if (attr is ValidationAttribute) return true;
                }
            }
        }

        return false;
    }

    private static bool IsSimpleType(Type type)
    {
        return type.IsPrimitive
            || type.IsEnum
            || type == typeof(string)
            || type == typeof(decimal)
            || type == typeof(DateTime)
            || type == typeof(DateTimeOffset)
            || type == typeof(TimeSpan)
            || type == typeof(DateOnly)
            || type == typeof(TimeOnly)
            || type == typeof(Guid)
            || (Nullable.GetUnderlyingType(type) is { } inner && IsSimpleType(inner));
    }
}
