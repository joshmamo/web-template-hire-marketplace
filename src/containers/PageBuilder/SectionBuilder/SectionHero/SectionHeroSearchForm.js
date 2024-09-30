import React, { useEffect, useState } from 'react';
import { bool, func, object, string } from 'prop-types';
import { Form as FinalForm, Field } from 'react-final-form';
import { useHistory } from 'react-router-dom';
import { Stack, IconButton, Select, MenuItem, InputLabel, FormControl, Box, Button, Divider, Autocomplete, TextField } from '@mui/material';
import { Search as SearchIcon, LocationOn as LocationIcon } from '@mui/icons-material';

import { intlShape, injectIntl } from '../../../../util/reactIntl';
import { isMainSearchTypeKeywords } from '../../../../util/search';
import { useSupabase } from '../../../../supabase/SupabaseContext';
import { LocationAutocompleteInput } from '../../../../components';

import css from './SectionHeroSearchForm.module.css';

const identity = v => v;

const CategorySelectField = ({ categories, intl }) => (
  <Field
    name="category"
    render={({ input }) => (
      <FormControl fullWidth>
       <Autocomplete
          id="category-autocomplete"
          options={categories}
          getOptionLabel={(option) => option.name} // Using 'name' for displaying in the list and for searching
          value={categories.find(category => category.key === input.value) || null} // Find the selected category based on the key
          onChange={(event, newValue) => {
            input.onChange(newValue ? newValue.key : ''); // Set the selected category's key to form state
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={intl.formatMessage({ id: 'SectionHeroSearchForm.categoryPlaceholder' })} // Label for the input
              variant="outlined"
              fullWidth
            />
          )}
          renderOption={(props, option) => (
            <li {...props} key={option.key}>
              {option.name}
            </li>
          )}
          disableClearable
        />
      </FormControl>
    )}
  />
);

const LocationSearchField = ({ intl, inputRef, onLocationChange }) => (
  <div style={{ width: '100%', border: 'none' }}>
    <Field
      name="location"
      format={identity}
      render={({ input, meta }) => {
        const { onChange, ...restInput } = input;

        const searchOnChange = value => {
          onChange(value);
          onLocationChange(value);
        };

        return (
          <LocationAutocompleteInput
            inputRef={inputRef}
            input={{ ...restInput, onChange: searchOnChange }}
            meta={meta}
            placeholder={intl.formatMessage({ id: 'SectionHeroSearchForm.locationPlaceholder' })}
            hideIcon={true}
          />
        );
      }}
    />
  </div>
);

const SectionHeroSearchFormComponent = props => {
  const { onSubmit, appConfig, intl, ...restOfProps } = props;
  const isKeywordsSearch = isMainSearchTypeKeywords(appConfig);

  const { supabase } = useSupabase();
  const [categories, setCategories] = useState([]);
  const history = useHistory();

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('product_families')
        .select('key, name');
      if (error) {
        console.error('Error fetching categories:', error);
      } else {
        // Sort categories alphabetically by 'name' property
        const sortedCategories = data.sort((a, b) => a.name.localeCompare(b.name));
        setCategories(sortedCategories);
      }
    };
    fetchCategories();
  }, [supabase]);
  
  const onChange = location => {
    if (!isKeywordsSearch && location.selectedPlace) {
      onSubmit({ location });
      searchInput?.blur();
    }
  };

  const onSubmitForm = values => {
    const { category, location } = values;
    const address = location.selectedPlace.address;
    const bounds = location.selectedPlace.bounds.ne.lat + ',' + location.selectedPlace.bounds.ne.lng + ',' + location.selectedPlace.bounds.sw.lat + ',' + location.selectedPlace.bounds.sw.lng;

    const url = `/s?pub_categoryLevel1=${category}&address=${encodeURIComponent(address)}&bounds=${encodeURIComponent(bounds)}`;
    history.push(url);
  };

  let searchInput = null;

  return (
    <FinalForm
      {...restOfProps}
      onSubmit={onSubmitForm}
      render={formRenderProps => {
        const { handleSubmit, values } = formRenderProps;
        const isFormValid = values.category && values.location && values.location.selectedPlace;
        return (
          <Box style={{ backgroundColor: 'white', padding: 4, borderRadius: 50 }}>
            <form onSubmit={handleSubmit} className={css.searchForm}>
              <Stack direction="row" spacing={2} alignItems="center">
                <LocationIcon style={{ marginLeft: 12 }} />
                <LocationSearchField intl={intl} inputRef={element => { searchInput = element; }} onLocationChange={onChange} />
                <Divider orientation="vertical" variant="middle" flexItem style={{ marginTop: 6, marginBottom: 6 }} />
                <CategorySelectField categories={categories} intl={intl} />
                <Button
                  variant="contained"
                  style={{
                    marginLeft: 10,
                    borderRadius: 100,
                    padding: 20,
                    backgroundColor: isFormValid ? '#FE9900' : '#B0B0B0', // Set primary color for enabled state
                  }}
                  type="submit"
                  disabled={!isFormValid}
                >
                  <SearchIcon />
                </Button>
              </Stack>
            </form>
          </Box>
        );
      }}
    />
  );
};

SectionHeroSearchFormComponent.defaultProps = {
  rootClassName: null,
  className: null,
  isMobile: false,
};

SectionHeroSearchFormComponent.propTypes = {
  rootClassName: string,
  className: string,
  onSubmit: func.isRequired,
  isMobile: bool,
  appConfig: object.isRequired,
  intl: intlShape.isRequired,
};

const SectionHeroSearchForm = injectIntl(SectionHeroSearchFormComponent);

export default SectionHeroSearchForm;
